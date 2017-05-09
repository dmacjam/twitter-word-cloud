import json
import tweepy
import sys
from kafka import KafkaProducer
import redis

r = redis.StrictRedis(host='127.0.0.1', port=6379, db=0)

def initialize(topic):
    with open('config/config.json') as config_data:
        config = json.load(config_data)

    auth = tweepy.OAuthHandler(config['consumer_key'], config['consumer_secret'])
    auth.set_access_token(config['access_token'], config['access_token_secret'])
    api = tweepy.API(auth)

    stream = TwitterStreamListener(config)
    twitter_stream = tweepy.Stream(auth = api.auth, listener=stream)
    twitter_stream.filter(track=[topic], async=False)


class TwitterStreamListener(tweepy.StreamListener):
    def __init__(self, config):
        super().__init__()
        self.producer = KafkaProducer(bootstrap_servers=config['docker_kafka_ip'],
                                      value_serializer=lambda v: json.dumps(v).encode('utf-8'))
        self.tweets = []
        self.config = config

    def on_data(self, data):
        data = json.loads(data)
        if (data.get('lang') != "en") and (data.get('retweeted')) and (data.get('favorited')) \
                    (data.get('is_quote_status')):
          return
        text = data.get('text', None)
        if text is None:
          return
        #text = text.encode('utf-8')
        output = {'text': text,
                  'id': data['id'],
                  'followers_count': data.get('user', {}).get('followers_count', 0)}
        self.producer.send(self.config['topic_name'], output)
        r.incr('!tweet_count!')
        self.producer.flush()
        print(json.dumps(output))


    def on_error(self, status_code):
        print(status_code)


if __name__ == "__main__":
    topic = sys.argv[1]
    print("Getting tweets about %s" % topic)
    initialize(topic)