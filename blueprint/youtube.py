from flask import Blueprint,request,jsonify,send_from_directory,abort,json,Response
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
prevVideo={}
video_states={}

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
@youtube.route('/stream/<video_id>',methods=['POST'])
def stream_video(video_id):
    # クエリパラメータから画質を取得(デフォルトは360p)
    data=request.get_json() #POSTのデータを取得
    quality=data.get("quality") #その中にあるqualityを取得
    
    is_video_mode=quality not in('128','48')
    video_states[video_id]={
        "status":"downloading",
        "height":None,
        "isVideo":is_video_mode
    }
    if video_states[video_id]["isVideo"]:
        file_name=f"{video_id}_{quality}p.mp4"
        if os.path.exists(os.path.join(SAVE_DIR,file_name)):
            video_states[video_id]["status"]="ready"
            video_states[video_id]["height"]=quality
            return jsonify({"started":True})
    else:
        file_name=f"{video_id}_{quality}.m4a"
        if os.path.exists(os.path.join(SAVE_DIR,file_name)):
            video_states[video_id]["status"]="ready"
            video_states[video_id]["height"]=quality
            return jsonify({"started":True})
    
    if not all(c.isalnum() or c in "-_" for c in video_id):
        abort(400, description="Invalid video ID")
    
    url=f"https://www.youtube.com/watch?v={video_id}"
    if is_video_mode:
        format_selector = f'bestvideo[height<={quality}][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<={quality}][ext=mp4]/best[height<={quality}]'
    else:
        format_selector='bestaudio[ext=m4a]/bestaudio'
    # ダウンロードできる最高画質を調べる
    with yt_dlp.YoutubeDL({
        'quiet':True,
        'format':format_selector,
    }) as ydl:
        if is_video_mode:
            try: #ファイル名に解像度を乗せたいのでydl.extract_infoで取得
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
        else:
            file_name=f"{video_id}_{quality}.m4a" # m4aはAAC+音声メタデータが入ったもの。データに対するインデックスがあるから再生が安定する
            file_path=os.path.join(SAVE_DIR,file_name)
            
            
    
    with download_lock:
        if not os.path.exists(file_path):
            if is_video_mode:
                ydl_options={
                'format':format_selector,
                # ネットワークエラー時に少し粘る設定を追加
                'retries': 10,
                'fragment_retries': 10,
                'outtmpl':file_path,
                'merge_output_format':'mp4',
                'ffmpeg_location':'/usr/bin',
                'quiet':True,
                'no_warnings':True,
                'nocheckcertificate': True,
                'geo_bypass': True,
				'postprocessor_args':[
						'-movflags','+faststart',
					],
                'headers': {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    }
                }
            else:
                ydl_options={
                    'format':'bestaudio/best',
                    'postprocessors':[{
                        'key':'FFmpegExtractAudio',
                        'preferredcodec':'m4a',
                        'preferredquality':str(quality),
                    }],
                    'outtmpl':os.path.join(SAVE_DIR, f"{video_id}_{quality}_tmp.%(ext)s"),
                    'ffmpeg_location':'/usr/bin',
                    'retries': 10,
                    'fragment_retries': 10,
                    'quiet':True,
                    'no_warnings':True,
                    'nocheckcertificate': True,
                    'geo_bypass': True,
                    'postprocessor_args':[
                    	'-b:a',f'{quality}k',
                    	'-ac','1',
                        '-movflags','+faststart',
                    ],
                    'headers': {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        }
                }
                ydl_options['postprocessor_args'] = [
                    '-b:a', f'{quality}k',
                    '-movflags', '+faststart'
                ]
            try:
                with yt_dlp.YoutubeDL(ydl_options) as ydl:
                    ydl.download([url])
                    downloaded_file = os.path.join(SAVE_DIR, f"{video_id}_{quality}_tmp.m4a")
                    if os.path.exists(downloaded_file):
                        os.rename(downloaded_file, file_path)
                    isCached=True
                    video_states[video_id]["status"]="ready"
                    if is_video_mode:
                        video_states[video_id]["height"]=actual_height
                    else:
                        video_states[video_id]["height"]=quality
            except Exception as e:
                video_states[video_id]["status"]="error"
                print(f"ダウンロードエラー{e}")
                if os.path.exists(file_path):
                    os.remove(file_path)
                    return jsonify({"error":str(e)}),500
                           
    return jsonify({"started":True})

#動画が取得できたらストリーミング
@youtube.route('/video/<video_id>')
def serve_video(video_id):
    mimetype="video/mp4"
    for file in os.listdir(SAVE_DIR):
        if file.startswith(video_id):
            if file.endswith(".mp4"):
                mimetype="video/mp4"
            else:
                mimetype="audio/mp4"
            return send_from_directory(SAVE_DIR,file,mimetype=mimetype,conditional=True)
    abort(404)

#動画が取得できたかのフラグを送信
@youtube.route('/status/<video_id>')
def video_status(video_id):
    state=video_states.get(video_id)
    if not state:
        return jsonify({"ready":False})
    return jsonify({
        "ready":state["status"]=="ready"
    })
