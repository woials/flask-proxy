from flask import Blueprint,request,jsonify,Response
import requests
import subprocess
from service.light_yt import search_videos,get_related_videos

youtube=Blueprint('youtube',__name__)

@youtube.route('/search')
def search():
    """request.args.getはURLクエリパラメータを取得するメソッド
    例えば
    user = request.args.get('user', 'ゲスト')
    とすると、http://localhost:5000/?user=太郎の場合はuser=太郎に、userパラメータがない場合はuser=ゲストになる"""

    query=request.args.get('q','')
    videos=search_videos(query)
    return jsonify(videos)#検索結果をjsonにして返す
@youtube.route('/related/<video_id>')
def related(video_id):
    videos=get_related_videos(video_id)
    return jsonify(videos)
@youtube.route('/stream/<video_id>')
def stream_video(video_id):
    url=f"https://www.youtube.com/watch?v={video_id}"
    """
    ●urlから--get-url
    youtubeの動画IDから実際の動画ファイルURLを取得する。
    Youtubeの動画URLは直接アクセスできないので、yt-dlp経由で取得する
    """
    cmd=[
        'yt-dlp',
        '-f','best[ext=mp4]',
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
    response.headers['Content-Type']=resp.headers.get('Content-Type','video/mp4')
    response.headers['Accept-Ranges']='bytes'
    # 必要なヘッダーを転送
    for key in ['Content-Range', 'Content-Length']:
        if key in resp.headers:
            response.headers[key] = resp.headers[key]
    
    return response
