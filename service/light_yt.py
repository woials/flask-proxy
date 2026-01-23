from flask import  request
import subprocess
import json


#動画を検索する関数
def search_videos(query,max_result=20):
    quoted_query=query
    #コマンドを組み立て
    cmd=[
        'yt-dlp',
        '-j',
        '--flat-playlist',
        '--print-json',
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
        '--skip-download',
        f'https://www.youtube.com/watch?v={video_id}'
    ]
    result=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8')
    try:
        data=json.loads(result.stdout)
        title=data.get('title','')
        uploader=data.get('uploader','')
        #タイトルとチャンネル名から関連動画を探す
        search_query=f"{title} {uploader}"
        return search_videos(search_query,max_results)
    except Exception as e:
        print(f"Error fetching related videos: {e}")
        return []