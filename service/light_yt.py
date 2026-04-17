from flask import  request
import subprocess
import json
import os
import glob #正規表現に合うファイルを見つける
from pathlib import Path

current_dir=Path(__file__).parent #このファイルの親ディレクトリ(service)
video_dir=current_dir.parent/"static"/"videos" #同一階層にあるstaticの中にあるvideosディレクトリ
SAVE_DIR = "static/videos"

#動画を検索する関数
def search_videos(query,max_result=20):
    quoted_query=query
    #コマンドを組み立て
    cmd=[
        'yt-dlp',
        '-j',
        '--flat-playlist',
        '--print-json',
        '--extractor-args',
        'youtube:lang=ja',
        # ライブ配信を除外するフィルタ
        '--match-filter',
        'live_status == "not_live"',
        f'ytsearch{max_result}:{quoted_query}'
    ]
    print(f"DEBUG: Executing yt-dlp command: {' '.join(cmd)}")
    #コマンドを実行
    result=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8')
    videos=[]
    #cmdの出力を１行ごとに\nで区切る
    for line in result.stdout.strip().split('\n'):
        if result.returncode !=0:
            error=result.stderr
            if '429' in error:
               print("429:リクエストが多すぎます")
            else:
               print(error)
            continue
        if line:#もし検索結果があれば
            data=json.loads(line)#jsonに変換
            video_id=data.get('id')
            videos.append({
                'videoId':video_id,
                'title': data.get('title'),
                #--flat-playlistがないと、動画を検索➡動画ID取得➡各動画の詳細取得を最大クエリ数まで繰り返す
                #--flat-playlistがあるとサムネイルが取得できないが、サムネイルの配信URLは決まっているので、
                #ID+サムネイルURLを使ってサムネイルを取得する
                #わざわざサムネイルを取得するために通信する必要がない(ただアクセスすればいい)ので検索を高速化できる！                
                'thumbnailURL': f'https://i.ytimg.com/vi/{video_id}/default.jpg',
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
        '--skip-download',
        f'https://www.youtube.com/watch?v={video_id}'
    ]
    result=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8')
    try:
        data=json.loads(result.stdout)
        uploader=data.get('uploader','')
        channel_id=data.get('channel_id','')
       
        if(channel_id):
            search_query=f"{channel_id}"
        else:
            search_query=f"{uploader}"
        return search_videos(search_query,max_results)
    except Exception as e:
        print(f"Error fetching related videos: {e}")
        return []
    
def search_stored_videos():
    video_files=list(video_dir.glob("*.mp4"))
    return video_files


def get_quality_label(width, height):
    """幅と高さのうち、大きい方（長辺）を基準にラベルを判定する"""
    if not width or not height:
        return "unknown"
        
    side = max(width, height)
    
    if side >= 3840:
        return "2160p"
    elif side >= 2560:
        return "1440p"
    elif side >= 1920:
        return "1080p"
    elif side >= 1280:
        return "720p"
    elif side >= 854:
        return "480p"
    elif side >= 640:
        return "360p"
    elif side >= 426:
        return "240p"
    else:
        return "144p"
