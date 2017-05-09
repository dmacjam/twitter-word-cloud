from flask import Flask, render_template, Response, request
from subprocess import Popen
import redis
import os
import shutil
import time
import atexit
import json

app = Flask(__name__)
r = redis.StrictRedis(host='127.0.0.1', port=6379, db=0)
tweets_script = None
processing_script = None
is_in_close_state = False
SPARK_HOME = os.environ.get('SPARK_HOME')


def new_words_stream():
    global is_in_close_state
    if is_in_close_state:
        return None
    else:
        return r.get('!words!')


def tweets_for_word(word):
    tweet_ids = list(r.smembers(word))
    return [id.decode('utf-8') for id in tweet_ids]


def total_tweets_count():
    return r.get('!tweet_count!')


@app.route('/')
def show_homepage():
    return render_template("cloud.html")


@app.route('/tweets_for_word', methods=['POST'])
def tweets_word():
    return Response(json.dumps(tweets_for_word(request.json['word'])), mimetype="application/json")


@app.route('/stream')
def stream():
    return Response(new_words_stream(), mimetype="application/json")


@app.route('/tweet_count')
def tweet_count():
    return Response(total_tweets_count(), mimetype="application/json")


@app.route('/topic', methods=['POST'])
def topic():
    global tweets_script, processing_script
    FNULL = open(os.devnull, 'w')
    if request.json:
        print(request.json['topic'])
        close_running_threads()
        tweets_script = Popen(['python', 'datasource/twitter_stream.py', request.json['topic']],
                              stdout=FNULL)
        processing_script = Popen([SPARK_HOME+'/bin/spark-submit',
                               '--jars', 'jar/spark-streaming-kafka-0-8-assembly_2.11-2.0.2.jar',
                               '--master', 'local[*]',
                               'processing/trending_words.py'],
                                stdout=FNULL)

    return ('', 204)


@app.route('/shutdown', methods=['GET'])
def shutdown():
    close_running_threads()
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()
    return 'Server shutting down...'


@app.route('/close', methods=['GET'])
def close():
    close_running_threads()
    return ('', 204)


def close_running_threads():
    global tweets_script, processing_script, is_in_close_state
    if tweets_script and processing_script:
        is_in_close_state = True
        tweets_script.terminate()
        tweets_script = None
        time.sleep(2)
        processing_script.terminate()
        processing_script = None
        time.sleep(3)
        shutil.rmtree('./checkpoint-tweet')
        r.delete('!words!')
        r.delete('!tweet_count!')
        print("Threads are terminated")
        time.sleep(1)
        is_in_close_state = False


if __name__ == '__main__':
    atexit.register(close_running_threads)
    app.run(threaded=True,
    host='0.0.0.0', debug=True
)
