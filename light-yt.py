from flask import Flask, Response, request, jsonify, send_file,render_template
import subprocess
import json
import requests

app = Flask(__name__)

#<ルートで表示したい項目を処理する関数>

#動画を検索する関数
def search_videos(query,max_result=20):
    quoted_query=f'"{query}"'
    #コマンドを組み立て
    cmd=[
        'yt-dlp',
        '-j',
        '--flat-playlist',
        f'ytsearch{max_result}:{quoted_query}'
    ]
    print(f"DEBUG: Executing yt-dlp command: {' '.join(cmd)}")
    #コマンドを実行
    result=subprocess.run(cmd,capture_output=True,text=True)
    videos=[]
    #cmdの出力を１行ごとに\nで区切る
    for line in result.stdout.strip().split('\n'):
        if line:#もし検索結果があれば
            data=json.loads(line)#jsonに変換
            video_id=data.get('id')
            videos.append({
                'id':video_id,
                'title': data.get('title'),
                #--flat-playlistがないと、動画を検索➡動画ID取得➡各動画の詳細取得を最大クエリ数まで繰り返す
                #--flat-playlistがあるとサムネイルが取得できないが、サムネイルの配信URLは決まっているので、
                #ID+サムネイルURLを使ってサムネイルを取得する
                #わざわざサムネイルを取得するために通信する必要がない(ただアクセスすればいい)ので検索を高速化できる！                
                'thumbnail': f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
                'description': data.get('description'),
                'duration': data.get('duration'),
                'uploader': data.get('uploader'),
                'view_count': data.get('view_count')
            })
    return videos

#関連動画を検索する関数
def get_related_videos(video_id,max_results=10):
    cmd=[
        'yt-dlp',
        '-j',
        '--flat-playlist',
        f'https://www.youtube.com/watch?v={video_id}'
    ]
    result=subprocess.run(cmd,capture_output=True,text=True)
    try:
        data=json.loads(result.stdout)
        title=data.get('title','')
        uploader=data.get('uploader','')
        #タイトルとチャンネル名から関連動画を探す
        search_query=f"{title} {uploader}"
        return search_videos(search_query,max_results)
    except:
        return []

#＜それぞれのエンドポイントで実行する関数＞
@app.route('/search')
def search():
    """request.args.getはURLクエリパラメータを取得するメソッド
    例えば
    user = request.args.get('user', 'ゲスト')
    とすると、http://localhost:5000/?user=太郎の場合はuser=太郎に、userパラメータがない場合はuser=ゲストになる"""

    query=request.args.get('q','')
    videos=search_videos(query)
    return jsonify(videos)#検索結果をjsonにして返す
@app.route('/related/<video_id>')
def related(video_id):
    videos=get_related_videos(video_id)
    return jsonify(videos)
@app.route('/stream/<video_id>')
def stream_video(video_id):
    url=f"https://www.youtube.com/watch?v={video_id}"
    """
    ●urlから--get-url
    youtubeの動画IDから実際の動画ファイルURLを取得する。
    Youtubeの動画URLは直接アクセスできないので、yt-dlp経由で取得する
    """
    cmd=[
        'yt-dlp',
        '-f','bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--get-url',
        url
    ]
    result=subprocess.run(cmd,capture_output=True,text=True)
    video_url=result.stdout.strip().split('\n')[0]
    #Rangeヘッダー:動画のシーク機能に必要
    range_header=request.headers.get('Range')
    headers={}
    if range_header:
        headers['Range']=range_header
    resp=requests.get(video_url,headers=headers,stream=True)

    def generate():
        for chunk in resp.iter_content(chunk_size=1024*64):#動画を64KBごとに分割する
            if chunk:
                yield chunk#もしchunkがあれば64KBに分割して継続的に出力する
    """
    Youtubeからの応答ヘッダーをブラウザに転送する
    Accept-Ranges:bytesでシーク可能と伝える
    Content-Type:video/mp4で動画ファイルと伝える
    """
    response=Response(generate(),status=resp.status_code)
    response.headers['Content-Type']=resp.headers.get('Content-Type','vieo/mp4')
    response.headers['Accept-Ranges']='bytes'
    if 'Content-Range' in resp.headers:
        response.headers['Content-Range'] = resp.headers['Content-Range']
    if 'Content-Length' in resp.headers:
        response.headers['Content-Length'] = resp.headers['Content-Length']
    
    return response

@app.route('/')
def index():
    return render_template('index.html')




if __name__ == "__main__":
    app.run(debug=True,port=5000)
