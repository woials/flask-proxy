from flask import Blueprint, request, jsonify, send_from_directory, abort, json, Response
# 動画検索と関連動画取得のサービスをインポート
from service.light_yt import search_videos, get_related_videos, search_stored_videos,get_quality_label
from service.DBmodel import SessionLocal, Video, get_videos_by_type, insert, select, store_videos,count_stored,delete_stored_by_videoId,is_exist_videoId
from collections import defaultdict
import os
import yt_dlp
import threading
import time
import ffmpeg
import requests
import datetime

youtube = Blueprint('youtube', __name__)
SAVE_DIR = "static/videos"
download_lock = threading.Lock()
prevVideo = {}
video_states = {}

# 保存用ディレクトリの作成
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR, exist_ok=True)


@youtube.route('/search')
def search():
    """request.args.getはURLクエリパラメータを取得するメソッド
    例えば
    user = request.args.get('user', 'ゲスト')
    とすると、http://localhost:5000/?user=太郎の場合はuser=太郎に、userパラメータがない場合はuser=ゲストになる"""

    query = request.args.get('q', '')
    videos = search_videos(query)
    return jsonify(videos)  # 検索結果をjsonにして返す


@youtube.route('/related/<video_id>')
def related(video_id):
    videos = get_related_videos(video_id)
    return jsonify(videos)


@youtube.route('/stream/<video_id>', methods=['POST'])
def stream_video(video_id):
    # クエリパラメータから画質を取得(デフォルトは360p)
    data = request.get_json()  # POSTのデータを取得
    quality = data.get("quality")  # その中にあるqualityを取得
    # json保存用のデータを取得
    title = data.get("title")
    duration = data.get("duration")

    is_video_mode = quality not in ('128', '48')
    video_states[video_id] = {
        "status": "downloading",
        "height": None,
        "isVideo": is_video_mode
    }
    
    if not all(c.isalnum() or c in "-_" for c in video_id):
        abort(400, description="Invalid video ID")

    url = f"https://www.youtube.com/watch?v={video_id}"
    if is_video_mode:
        format_selector = f'bestvideo[height<={quality}][vcodec^=avc1]+bestaudio[ext=m4a]/best[height<={quality}][ext=mp4]/best[height<={quality}]'
    else:
        format_selector = 'bestaudio[ext=m4a]/bestaudio'
    # ダウンロードできる最高画質を調べる
    with yt_dlp.YoutubeDL({
        'quiet': True,
        'format': format_selector,
    }) as ydl:
        if is_video_mode:
            try:  # ファイル名に解像度を乗せたいのでydl.extract_infoで取得
                info = ydl.extract_info(url, download=False)
                # 選択されたフォーマットの実際の高さを取得
                if 'requested_formats' in info:
                    # 映像と音声が分離している場合
                    actual_width = info['requested_formats'][0].get(
                        'width', quality)
                    actual_height = info['requested_formats'][0].get('height',quality)
                else:
                    # 単一フォーマットの場合
                    actual_width = info.get('width', quality)
                    actual_height = info.get('height', quality)
            except Exception as e:
                return jsonify({"error": f"情報取得失敗: {str(e)}"}), 500
            # 画質ごとにファイル名を分ける
            # シネマスコープ対応のため、幅で判断する
            label=get_quality_label(actual_width, actual_height)
            quality=label.replace("p","")
            file_name = f"{video_id}_{label}.mp4"
            file_path = os.path.join(SAVE_DIR, file_name)
        else:
            # m4aはAAC+音声メタデータが入ったもの。データに対するインデックスがあるから再生が安定する
            file_name = f"{video_id}_{quality}.m4a"
            file_path = os.path.join(SAVE_DIR, file_name)
# キャッシュヒットの処理。動画がすでに保存されている場合は、ダウンロードせずにready状態にする
    # DBを更新してstatusをreadyにする
    if video_states[video_id]["isVideo"]:
        file_name = f"{video_id}_{label}.mp4"
        if os.path.exists(os.path.join(SAVE_DIR, file_name)):
            video_states[video_id]["status"] = "ready"
            video_states[video_id]["height"] = quality
            try:
                metadata = {
                    "video_id": video_id,
                    "title": title,
                    "duration": duration,
                    "thumbnail_path": os.path.join(SAVE_DIR, f"{video_id}_thumbnail.jpg"),
                    "file_path": os.path.join(SAVE_DIR, file_name),
                    "type": "video",
                    "quality": f"{quality}p",
                    "added_at": datetime.datetime.now().isoformat()
                }
                store_videos(metadata)
            except Exception as e:
                print(f"DBへの保存に失敗しました: {e}")
            return jsonify({"started": True,"actual_height":actual_height})
    else:
        file_name = f"{video_id}_{quality}.m4a"
        if os.path.exists(os.path.join(SAVE_DIR, file_name)):
            video_states[video_id]["status"] = "ready"
            video_states[video_id]["height"] = quality
            try:
                metadata = {
                    "video_id": video_id,
                    "title": title,
                    "duration": duration,
                    "thumbnail_path": os.path.join(SAVE_DIR, f"{video_id}_thumbnail.jpg"),
                    "file_path": os.path.join(SAVE_DIR, file_name),
                    "type": "audio",
                    "quality": f"{quality}kbps",
                    "added_at": datetime.datetime.now().isoformat()
                }
                store_videos(metadata)
            except Exception as e:
                print(f"DBへの保存に失敗しました: {e}")
            return jsonify({"started": True})

    with download_lock:  # 同時に複数のリクエストが来たときに、同じ動画を複数回ダウンロードしないように&JSONファイルの書き込みが競合しないようにロックする
        if not os.path.exists(file_path):
            # 動画ダウンロードのコマンドを組み立てる
            if is_video_mode:
                ydl_options = {
                    'format': format_selector,
                    # ネットワークエラー時に少し粘る設定を追加
                    'retries': 10,
                    'fragment_retries': 10,
                    'outtmpl': file_path,
                    'merge_output_format': 'mp4',
                    'ffmpeg_location': '/usr/bin',
                    'quiet': True,
                    'no_warnings': True,
                    'nocheckcertificate': True,
                    'geo_bypass': True,
                    'postprocessor_args': [
                        '-movflags', '+faststart',
                    ],
                    'headers': {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    }
                }
            else:
                # 音声ダウンロードのコマンドを組み立てる
                ydl_options = {
                    'format': 'bestaudio/best',
                    'postprocessors': [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'm4a',
                        'preferredquality': str(quality),
                    }],
                    'outtmpl': os.path.join(SAVE_DIR, f"{video_id}_{quality}_tmp.%(ext)s"),
                    'ffmpeg_location': '/usr/bin',
                    'retries': 10,
                    'fragment_retries': 10,
                    'quiet': True,
                    'no_warnings': True,
                    'nocheckcertificate': True,
                    'geo_bypass': True,
                    'postprocessor_args': [
                        '-b:a', f'{quality}k',
                        '-ac', '1',
                        '-movflags', '+faststart',
                    ],
                    'headers': {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    }
                }
                ydl_options['postprocessor_args'] = [
                    '-b:a', f'{quality}k',
                    '-movflags', '+faststart'
                ]
            # ダウンロードとファイルのリネームを行う
            try:
                with yt_dlp.YoutubeDL(ydl_options) as ydl:
                    ydl.download([url])
                    downloaded_file = os.path.join(
                        SAVE_DIR, f"{video_id}_{quality}_tmp.m4a")
                    if os.path.exists(downloaded_file):
                        os.rename(downloaded_file, file_path)
                    isCached = True
                    video_states[video_id]["status"] = "ready"
                    if is_video_mode:
                        video_states[video_id]["height"] = actual_height
                    else:
                        video_states[video_id]["height"] = quality
            except Exception as e:
                video_states[video_id]["status"] = "error"
                print(f"ダウンロードエラー{e}")
                if os.path.exists(file_path):
                    os.remove(file_path)
                    return jsonify({"error": str(e)}), 500
            # 動画のサムネイルを保存する
            # URLはhttps://i.ytimg.com/vi/{video_id}/default.jpgで取得できる
            thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/default.jpg"
            thumbnail_path = os.path.join(
                SAVE_DIR, f"{video_id}_thumbnail.jpg")
            try:
                response = requests.get(thumbnail_url)
                with open(thumbnail_path, "wb") as f:
                    f.write(response.content)
            except Exception as e:
                print(f"サムネイルのダウンロードエラー{e}")

            # 管理用のJSONファイルを作成
            # todo:必要なデータ:video_id,タイトル,動画の長さ,サムネイルURL,サムネイルの保存先パス,解像度(動画の解像度/音声ビットレート)
            # 解像度は動画と音声で違うから、動画の解像度はquality、音声の解像度はbitrateで管理する
            # todo:動画と音声の解像度の分岐処理
            # todo:JSONでの保存はスケールしないので、sqliteに移行することも検討する

            json_path = os.path.join(SAVE_DIR, "videos.json")
            # JSONファイルを読み込む。存在しない場合は新規作成する
            if os.path.exists(json_path):
                try:
                    with open(json_path, "r", encoding='utf-8') as f:
                        video_list = json.load(f)
                except Exception as e:
                    video_list = []
            else:
                video_list = []
            # 今回保存する動画のメタデータを作成
            metadata = {
                "video_id": video_id,
                "title": title,
                "duration": duration,
                "thumbnail_path": thumbnail_path,
                "file_path": file_path,
                "type": "video" if is_video_mode else "audio",
                "quality": f"{actual_height}p" if is_video_mode else f"{quality}kbps",
                "added_at": datetime.datetime.now().isoformat()
            }
            # 重複チェック
            exist = False
            for i, item in enumerate(video_list):
                if item["video_id"] == video_id and item["quality"] == metadata["quality"]:
                    video_list[i] = metadata
                    exist = True
                    break
            if not exist:
                video_list.append(metadata)
            # DBに保存する
            try:
                store_videos(metadata)
            except Exception as e:
                print(f"DBへの保存に失敗しました: {e}")
    return jsonify({"started": True})

# 動画が取得できたらストリーミング


@youtube.route('/video/<video_id>')
def serve_video(video_id):
    mimetype = "video/mp4"
    for file in os.listdir(SAVE_DIR):
        if file.startswith(video_id):
            if file.endswith(".mp4"):
                mimetype = "video/mp4"
            else:
                mimetype = "audio/mp4"
            return send_from_directory(SAVE_DIR, file, mimetype=mimetype, conditional=True)
    abort(404)

# 動画が取得できたかのフラグを送信


@youtube.route('/status/<video_id>')
def video_status(video_id):
    state = video_states.get(video_id)
    if not state:
        return jsonify({"ready": False})
    return jsonify({
        "ready": state["status"] == "ready"
    })


r"""DB関連処理群"""

# サーバに保存してある動画・音声の一覧を返す
@youtube.route('/server/videos')
def return_stored_videos():
    stored_videos = get_videos_by_type(isVideo=True)  # 動画ファイルのリストを取得
    stored_audios = get_videos_by_type(isVideo=False)  # 音声ファイルのリストを取得
    stored={
        "videos":stored_videos,
        "audios":stored_audios
    }
    json_str=json.dumps(stored,ensure_ascii=False,indent=4)
    return Response(json_str, mimetype='application/json; charset=utf-8')

@youtube.route('/server/delete', methods=['POST'])
def delete_stored_videos():
    data = request.get_json()
    videoId=data.get("videoId")
    isVideo=data.get('isVideo')
    delete_stored_by_videoId(videoId,isVideo)

    # 実ファイルを削除
    files=os.listdir(SAVE_DIR)
    try:
        for file in files:
            file_path=os.path.join(SAVE_DIR,file)
            if isVideo:
                if file.startswith(videoId) and file.endswith(".mp4"):
                    if os.path.exists(file_path):
                        os.remove(file_path)
            else:
                if file.startswith(videoId) and file.endswith(".m4a"):
                    if os.path.exists(file_path):
                        os.remove(file_path)

        if not is_exist_videoId(videoId):
            thumbnail_path=os.path.join(SAVE_DIR,f"{videoId}_thumbnail.jpg")
            if os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
    except Exception as e:
        print(f"error:{e}")
                
    result={
        "deleted":"ok"
    }
    json_str=json.dumps(result,ensure_ascii=True,indent=4)
    return Response(json_str,mimetype='application/json; charset=utf-8')



@youtube.route('/server/count')
def return_stored_counts():
    video_count = count_stored(isVideo=True)
    audio_count = count_stored(isVideo=False)
    return jsonify({
        "video_count": video_count,
        "audio_count": audio_count
    })

@youtube.route('/server/thumbnail/<video_id>')
def return_thumbnail(video_id):
    thumbnail_path = os.path.join(SAVE_DIR, f"{video_id}_thumbnail.jpg")
    if os.path.exists(thumbnail_path):
        return send_from_directory(SAVE_DIR, f"{video_id}_thumbnail.jpg", mimetype='image/jpeg')
    abort(404)

@youtube.route('/server/thumbnail/redownload',methods=['POST'])
def redownload_thumbnail():
    data = request.get_json()
    ID = data.get("videoId")
    thumbnail_url = f"https://i.ytimg.com/vi/{ID}/default.jpg"
    thumbnail_path = os.path.join(
    SAVE_DIR, f"{ID}_thumbnail.jpg")
    try:
        response = requests.get(thumbnail_url)
        with open(thumbnail_path, "wb") as f:
            f.write(response.content)
        return jsonify({"download":"ok"})
    except Exception as e:
        print(f"サムネイルのダウンロードエラー{e}")
        return jsonify({"download":"error"})


@youtube.route('/server/stream/<video_id>')
def stream_stored(video_id):
    quality=request.args.get("quality")
    print(f"ストリーミングリクエスト: video_id={video_id}, quality={quality}")
    files=os.listdir(SAVE_DIR)
    for file in files:
        if file.startswith(video_id) and (quality in file): # video_idとqualityの両方を満たすファイルを探す。これで動画と音声の区別もつく
            return send_from_directory(SAVE_DIR, file, conditional=True)
    for file in files: # 万が一qualityのパラメータがない場合はvideo_idだけで探す
        if file.startswith(video_id):
            return send_from_directory(SAVE_DIR, file, conditional=True)
    abort(404)

