# from flask import request,jsonify,Response
# from faster_whisper import WhisperModel
# import subprocess
# import re

# GEMINI_PROMPT=None

# def mp3_transcribe():
#     buffer = []
#     model = WhisperModel("small", device="cpu", compute_type="int8")
#     segments, info = model.transcribe("static/test.mp3", beam_size=5)

#     for segment in segments:
#         text = segment.text.strip()
#         if not text:
#             continue

#         buffer.append(text)
#         if len(buffer) >= 10:  # 10文単位でまとめる
#             yield '。'.join(buffer) + '。'
#             buffer.clear()

#     if buffer:
#         yield '。'.join(buffer) + '。'

        
        
# """
# 正規表現の説明
# r:raw文字列を表す。エスケープシーケンスを無効にする
# re.split:正規表現に基づいて文字列を分割する関数
# (。|.|!|?):句点「。」、ピリオド「.」、感嘆符「!」、疑問符「?」のいずれかにマッチするグループを定義
# ()があることで、分割後のリストに区切り文字も含まれる
# ➡(今日は天気がいいです。明日も晴れるかな？)→['今日は天気がいいです', '。', '明日も晴れるかな', '？', '']
# sentence=[''.join(sentence[i:i+2]) for i in range(0,len(sentence)-1,2)]
# range(0,len(sentence)-1,2):0からlen(sentence)-1まで2つ飛ばしでインデックスを生成
# ➡range(0,5-1,2)→0から4まで2つ飛ばし→0,2
# sentence[i:i+2]:インデックスiからi+2までの要素をスライスで取得
# ➡i=0→sentence[0:2]→['今日は天気がいいです', '。']
#    i=2→sentence[2:4]→['明日も晴れるかな', '？']
# ''.join(...):スライスで取得したリストの要素を結合して1つの文字列にする
# ➡i=0→'今日は天気がいいです。'
#    i=2→'明日も晴れるかな？'
# ▶最終的に、文章のリストが得られる ['今日は天気がいいです。', '明日も晴れるかな？']
# """
        
# def gemini_format(text_block:str):
#     global GEMINI_PROMPT
#     if GEMINI_PROMPT is None:
#         with open("prompt.txt",mode="r",encoding="utf-8")as f:
#                 GEMINI_PROMPT=f.read().replace("\n","")

#     command=[r"C:\Users\jyo05\AppData\Roaming\npm\gemini.cmd", "--prompt", GEMINI_PROMPT]
#     result=subprocess.run(
#         command,
#         input=text_block,
#         capture_output=True,
#         text=True,
#         encoding="utf-8"
#     )
#     if result.returncode == 0:
#         return {
#            "text": result.stdout,
#            "status":"ok"
#            }
#     else:
#         return {
#             "text": result.stderr,
#             "status":"error"
#         }
        
# """
# 〇faster-whisperの高速化
# 1.AVX2.0命令セット対応のCPUを使用する
# 2.oneMKL版のfaster-whisperをインストールする(intel CPU向け)
# pipで普通にインストールする場合、OpenBLAS版がインストールされる
# ・oneMKL版のインストール方法
# 1.Intel oneAPI BASE Toolkitをインストールする
# 2.oneAPIの環境を有効化する
# "C:\Program Files (x86)\Intel\oneAPI\setvars.bat"に入っているはず
# 3.その状態でCTranslate2をビルド or oneMKL版wheelを使う
# まずはpython -m pip install -U ctranslate2を試してみる(wheelがあればoneMKL版がインストールされる)
# もしOpenBLAS版がインストールされた場合、pip install --no-binary=ctranslate2 ctranslate2
# でソースコードからビルドする(時間かかる)
# """