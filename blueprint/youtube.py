from flask import Blueprint,request,jsonify,send_from_directory,abort
# 動画検索と関連動画取得のサービスをインポート
from service.light_yt import search_videos,get_related_videos
import os
import yt_dlp
import threading
import time
import ffmpeg

youtube=Blueprint('youtube',__name__)
SAVE_DIR="static/videos"
download_lock=threading.Lock()
prevVideo=None

# 保存用ディレクトリの作成
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR, exist_ok=True)

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
    # クエリパラメータから画質を取得(デフォルトは360p)
    quality=request.args.get('quality')
    if not all(c.isalnum() or c in "-_" for c in video_id):
        abort(400, description="Invalid video ID")
    
    url=f"https://www.youtube.com/watch?v={video_id}"
    format_selector = f'bestvideo[height<={quality}][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<={quality}][ext=mp4]/best[height<={quality}]'

    # ダウンロードできる最高画質を調べる
    with yt_dlp.YoutubeDL({
        'quiet':True,
        'format':format_selector,
    }) as ydl:
        try:
            info=ydl.extract_info(url,download=False)
            # 選択されたフォーマットの実際の高さを取得
            if 'requested_formats' in info:
                # 映像と音声が分離している場合
                actual_height = info['requested_formats'][0].get('height', quality)
            else:
                # 単一フォーマットの場合
                actual_height = info.get('height', quality)
        except Exception as e:
            return jsonify({"error": f"情報取得失敗: {str(e)}"}), 500
    # 画質ごとにファイル名を分ける
    file_name=f"{video_id}_{actual_height}p.mp4"
    file_path=os.path.join(SAVE_DIR,file_name)
    
    # 次の動画を再生した後、前の動画のキャッシュを削除する
    global prevVideo
    current=file_name
    
    if prevVideo is not None and prevVideo !=current:
        delete_path=os.path.join(SAVE_DIR,prevVideo)
        if os.path.exists(delete_path):
            os.remove(delete_path)
        else:
            print(f"{delete_path}が存在しません")
    prevVideo=current
    
    with download_lock:
        if not os.path.exists(file_path):
            ydl_options={
            'format':format_selector,
            # ネットワークエラー時に少し粘る設定を追加
            'retries': 10,
            'fragment_retries': 10,
            'outtmpl':file_path,
            'merge_output_format':'mp4',
            'ffmpeg_location':'./ffmpeg.exe',
            'quiet':True,
            'no_warnings':True,
            'nocheckcertificate': True,
            'geo_bypass': True,
            'headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            }
            try:
                with yt_dlp.YoutubeDL(ydl_options) as ydl:
                    ydl.download([url])
                    isCached=True
            except Exception as e:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    return jsonify({"error":str(e)}),500
                    
    return send_from_directory(SAVE_DIR,file_name)
    

