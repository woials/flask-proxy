from datetime import datetime
import json
import time
import threading
from zoneinfo import ZoneInfo
from service.extract_paragraph import get_full_article,get_RSS_feed,RSS_SOURCES,RSS_URL
from flask import Blueprint, Response, render_template, request, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
from urllib.parse import unquote #URLエンコード(%〇〇形式)をデコードするための関数

news=Blueprint('news', __name__)

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

@news.route('/api/article/stream')
def stream_articles():
    def generate():
        sent_links=set() #ハッシュテーブル
        while True:
            found_new_article=False
            all_articles_ready=True

            for source,entries in cached_entries.items():
                for entry in entries:
                    # entryに"article"という項目があり、entry["article"]に文字列が入っているとTrue
                    if "article" in entry and entry["article"]: 
                        link=entry.get("link")
                        article_text=entry.get("article")
                        #すでに送信している場合はスルー
                        if link in sent_links:
                            continue
                        if article_text:
                            data=json.dumps({
                                "source":source,
                                "link":link,
                                "article":article_text,
                                "status":"sent"
                            }, ensure_ascii=False)
                            yield f"data: {data}\n\n"
                            #送信済みリストに追加
                            sent_links.add(link)
                            found_new_article=True
                        else: #本文が空なものがあればまだ完了していない
                            all_articles_ready=False
            # 全ての記事データを送信出来たらループを抜ける
            if all_articles_ready:
                break
            time.sleep(1) # 1秒待機
        data=json.dumps({"status":"completed"})
        yield f"data: {data}\n\n"
    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":"no-cache",
            "X-Accel-Buffering":"no"
        }
    )
                    

# 定期的にRSSを更新するためのスケジューラー
# サーバ起動時に1回実行し、以降は１５分ごとに更新する
def update_RSS_cache():
    for i,url in enumerate(RSS_URL):
        cached_entries.update(get_RSS_feed(i,url))
        time.sleep(1) #リクエスト間隔を空ける
    fetch_articles_background() #RSS更新後に記事も先読みする

def fetch_articles_background():
    for source,entries in cached_entries.items():
        for entry in entries:
            if "article" not in entry:
                try:
                    entry["article"]=get_full_article(entry["link"])
                    time.sleep(2)
                except Exception as e:
                    print(f"error fetching article {entry['link']}: {e}")
                    entry['article']=''
                    continue

for i, url in enumerate(RSS_URL):
    cached_entries.update(get_RSS_feed(i,url))
# サーバ起動時にバックグラウンドで記事を先読みするスレッドを開始
# daemon=Trueにすると、メインスレッド(Flask)が終了すると、このスレッドも自動的に終了する
threading.Thread(target=fetch_articles_background,daemon=True).start()

# 定期的に実行する処理をスケジューラーに登録
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