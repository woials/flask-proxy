from flask import Blueprint,request,jsonify,Response,url_for,render_template
import requests
from concurrent.futures import ThreadPoolExecutor,as_completed

radio=Blueprint('radio',__name__)
from service.transcription import mp3_transcribe
from service.transcription import gemini_format
@radio.route('/web/radio')#ブラウザ用のラジオ情報取得処理
def get_radio_transcription():
    transcribe=mp3_transcribe()
    params={
        "text":transcribe
    }
    return render_template('radio.html',**params)  #**をつけると辞書のキーが変数名として格納される
@radio.route('/api/stream')#音声文字起こしのストリーミング処理
def stream():
    def generate():
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures=[]
            for text_block in mp3_transcribe():
                futures.append(
                    executor.submit(gemini_format,text_block)
                )
            for future in as_completed(futures):
                formatted=future.result()
                if formatted["status"]=="ok":
                    yield f"data:{formatted['text']}\n\n"
                else:
                    yield f"data:Error: {formatted['text']}\n\n"
        yield "event:end\ndata:end\n\n" 
    return Response(generate(), mimetype='text/event-stream')