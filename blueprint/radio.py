from flask import Blueprint,request,jsonify,Response,url_for,render_template
import requests
from concurrent.futures import ThreadPoolExecutor,as_completed
import threading
radio=Blueprint('radio',__name__)
from service.transcription import mp3_transcribe
from service.transcription import gemini_format
from service.radio import download_radio

update_in_progress=False
lock=threading.Lock() #排他制御用ロック

@radio.route('/web/radio')#ブラウザ用のラジオ情報取得処理
def get_radio_transcription():
    
    #transcribe=mp3_transcribe()
    
    params={
        "radio":radio,
        #"text":transcribe
    }
    return render_template('radio.html',**params)  #**をつけると辞書のキーが変数名として格納される

@radio.route('/web/radio/update',methods=['POST'])#ラジオ情報の更新処理
def update_radio():
    trigger_update()
    return jsonify({"status":"update queued"})

# ラジオ情報の更新を実行する関数
def run_update():
    global update_in_progress
    try:
        download_radio()
    finally:
        update_in_progress=False

# ラジオ情報の更新を非同期で実行する関数
def trigger_update():
    global update_in_progress
    with lock: #排他制御開始
        if update_in_progress:
            return
        update_in_progress=True
    executor=ThreadPoolExecutor(max_workers=1)
    executor.submit(run_update)


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