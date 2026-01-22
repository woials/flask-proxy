import feedparser
import requests
import os
import hashlib
import json
RSS_URL = "https://www.nhk.or.jp/s-media/news/podcast/list/v1/all.xml"
SAVE_DIR = os.path.join(".","static","radio_news")

# 保存用ディレクトリの作成
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)

def download_radio():
    feed = feedparser.parse(RSS_URL)
    
    for entry in feed.entries:
        # enclosureタグがあるか確認
        # hasattrは属性が存在するか確認する関数(boolを返す)
        if hasattr(entry, 'enclosures') and len(entry.enclosures) > 0:
            # 音声ファイルのURLを取得
            audio_url=None
            for e in entry.enclosures:
                if "audio" in e.type:
                    audio_url=e.href
                    break
            if not audio_url:
                continue
            # 一意のIDを使って保存先ディレクトリを決定
            raw_id = entry.get("guid") or entry.get("id") or entry.link
            id=hashlib.sha256(raw_id.encode()).hexdigest()
            radio_path = os.path.join(SAVE_DIR, id)
            os.makedirs(radio_path, exist_ok=True)
                
            title=entry.title
            
            file_name ="audio.mp3"
            save_path = os.path.join(radio_path, file_name)
            audio_exists=os.path.exists(save_path)
            if not audio_exists:
                print(f"Downloading: {file_name}...")
                
                # ダウンロード実行
                try:
                    response = requests.get(audio_url,stream=True,timeout=10)
                    response.raise_for_status()
                    temp_path = save_path + ".part"
                    expected=response.headers.get("Content-Length")
                    if expected is None:
                        expected=entry.get("length")
                    if expected is not None:
                        expected=int(expected)
                    with open(temp_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    actual=os.path.getsize(temp_path)
                    if expected is not None and actual != expected:
                        raise IOError("size mismatch")
                    os.replace(temp_path, save_path)
                    print("Download completed.")
                except requests.RequestException as e:
                    print(f"Failed to download {file_name}: {e}")
                    raise
            
        metadata_path=os.path.join(radio_path,"metadata.json")
        print(f"{radio_path}")
        print(f"{save_path}")
        print(f"{metadata_path}")
        if not os.path.exists(metadata_path):
            print("creating metadata.json...")
            # ラジオの情報をmetadata.jsonとして保存
            metadata={
                    "title":title,
                    "published":entry.get("pubDate", None),
                    "link":audio_url,
                    "guid":raw_id
            }
            metadata_path=os.path.join(radio_path,"metadata.json")
            temp_path=metadata_path+".tmp"
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=4)
            os.replace(temp_path, metadata_path)
            print("metadata.json created.")
    print("done.")
    return {"status":"completed"}

"""
            〇os.replace(temp_path, metadata_path)
            もしwrite()中にエラーが発生した場合、
            metadata_pathに直接書き込むとファイルが壊れる可能性がある。
            そこで一時ファイル(temp_path)に書き込みを行い、
            書き込みが成功した後でos.replace()を使って
            一時ファイルを正式なファイル名(metadata_path)に置き換える(疑似的な原子性を実現)。
            """