from datetime import datetime
import json
import time
from zoneinfo import ZoneInfo
from service.extract_paragraph import get_full_article,get_RSS_feed,RSS_SOURCES,RSS_URL
from flask import Blueprint, Response, render_template, request, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
from urllib.parse import unquote #URLエンコード(%〇〇形式)をデコードするための関数

news=Blueprint('news', __name__)

RSS_SOURCES=["TNC","TVQ","RKB","FBS","国内","IT"]
cached_entries = {}

@news.route('/api/top')
def news_top():
    return Response( 
        json.dumps(cached_entries,ensure_ascii=False),
        mimetype='application/json'
    )
#jsonify()は辞書のキーをアルファベット順にソートする
#json.dumps()は順序を保持する
@news.route('/api/article')
def article():
    encoded_url=request.args.get("q")
    if not encoded_url:
        return jsonify({"error":"URLが指定されていません"}),400
    url=unquote(encoded_url)
    try:
        article_text=get_full_article(url)
        return jsonify({"article":article_text})
    except Exception as e:
        return jsonify({"error":str(e)}),500

# 定期的にRSSを更新するためのスケジューラー
# サーバ起動時に1回実行し、以降は１５分ごとに更新する
def update_RSS_cache():
    for i,url in enumerate(RSS_URL):
        cached_entries.update(get_RSS_feed(i,url))
        time.sleep(1) #リクエスト間隔を空ける
        
for i, url in enumerate(RSS_URL):
    cached_entries.update(get_RSS_feed(i,url))
scheduler=BackgroundScheduler()
scheduler.add_job(update_RSS_cache,'interval',minutes=15)
scheduler.start()

r"""
TIPS:アンパック
配列やタプルなどの複数の要素があるデータ構造を、個々の変数に展開すること
entry.published_parsedは
(2026, 4, 20, 2, 9, 2, 0, 110, 0)
#  年   月  日  時 分 秒 ...以降は曜日等で不要
[:6]で最初の6要素を取得するが、そのままだと
datetime((2026, 4, 20, 2, 9, 2))
のようにタプル全体が1つの引数として渡されてしまう
アンパックを使うと
datetime(*[2026, 4, 20, 2, 9, 2])
# ↓ 実際にはこう展開される
datetime(2026, 4, 20, 2, 9, 2)
"""