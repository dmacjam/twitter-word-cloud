from __future__ import print_function
import json
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kafka import KafkaUtils
import redis
from nltk.corpus import stopwords
from gensim import utils

def takeAndPrint(time, rdd, num=50):
    r = redis.StrictRedis(host='127.0.0.1', port=6379, db=0)
    taken = rdd.take(num + 1)

    print("--------------------------------------")
    print("Time: %s" % time)

    data_json = []
    for record in taken[:num]:
        word = {}
        word_text = record[0]
        count, tweets_ids, followers_count = record[1]
        word['text'] = word_text
        word['csize'] = count
        word['followers_count'] = int(followers_count / count)
        data_json.append(word)
        r.delete(word_text)
        r.sadd(word_text, *tweets_ids[:10])
    print(data_json)
    r.set('!words!', json.dumps(data_json))


def updateFunc(new_values, last_sum):
    count = 0
    follower_count = 0
    counts = [field[0] for field in new_values]
    ids = [field[1] for field in new_values]
    followers_count = [field[2] for field in new_values]
    if last_sum:
        count = last_sum[0]
        new_ids = last_sum[1] + ids
        follower_count = last_sum[2]
    else:
        new_ids = ids
    return sum(counts) + count, new_ids, sum(followers_count) + follower_count


def split_tweet(x):
    words = list(utils.tokenize(x['text'], lowercase=True, deacc=False))
    return [(x['id'], x['followers_count'], word) for word in words]


if __name__ == "__main__":
    with open('config/config.json') as config_data:
        config = json.load(config_data)

    sc = SparkContext(appName="PythonTwitterStreaming")
    sc.setLogLevel("ERROR")
    ssc = StreamingContext(sc, 1)   # processing in N seconds

    kvs = KafkaUtils.createStream(ssc, 'localhost:2181',
                                  "spark-streaming-consumer", {config['topic_name']: 1})
    tweets = kvs.map(lambda x: x[1])

    # Needed by updateStateByKey for any case of failure
    ssc.checkpoint("./checkpoint-tweet")

    stop = stopwords.words('english')
    stop.extend(['rt', 'https', 'tweet', 'twitter', 'co', 'lt', 'htt', 'http', 'follow'])
    MIN_WORD_LENGTH = 2

    words = tweets.map(lambda x: json.loads(x))\
                            .flatMap(split_tweet) \
                            .filter(lambda x: len(x[2]) >= MIN_WORD_LENGTH) \
                            .filter(lambda x: x[2] not in stop)

    running_counts = words.map(lambda x: (x[2], (1, x[0], x[1]))) \
                          .updateStateByKey(updateFunc) \
                          .transform(lambda rdd: rdd.sortBy(lambda x: x[1][0], False))

    running_counts.foreachRDD(takeAndPrint)

    # Start processing
    ssc.start()
    ssc.awaitTermination()
