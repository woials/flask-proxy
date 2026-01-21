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
            futures={}             
            buffer={}
            next_index=0
            
            for i,text_block in enumerate(mp3_transcribe()):
                future=executor.submit(gemini_format,text_block)
                futures[future]=i
            
            for future in as_completed(futures):
                i=futures[future]
                formatted=future.result()
                buffer[i]=formatted
            
                while next_index in buffer:
                    item=buffer.pop(next_index)
                    if item["status"]=="ok":
                        yield f"data:{item['text']}\n\n"
                    else:
                        yield f"data:Error: {item['error']}\n\n"
                    next_index+=1
        yield "event: end\ndata: end\n\n"
    return Response(generate(),mimetype='text/event-stream')