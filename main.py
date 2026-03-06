from flask import Flask,render_template,redirect,url_for,send_from_directory
from blueprint.youtube import youtube
from blueprint.weather import weather
from blueprint.radio import radio
from blueprint.gemini import gemini
import os

app = Flask(__name__)
app.register_blueprint(youtube, url_prefix='/youtube')
app.register_blueprint(weather,url_prefix='/weather')
# app.register_blueprint(radio,url_prefix='/radio')
app.register_blueprint(gemini,url_prefix='/gemini')
basedir=os.path.dirname(os.path.abspath(__file__))

@app.after_request
def add_header(response):
    # ngrokの警告ページをスキップするためのヘッダー
    response.headers['ngrok-skip-browser-warning'] = 'true'
    return response
@app.route('/')
def index():
    return render_template('index.html')
@app.route('/sw.js')
def serve_sw():
    sw_path=os.path.join(basedir,'static','js')
    print(f"DEBUG: Looking for sw.js in {sw_path}") # コンテナのログで確認用
    
    resp=send_from_directory(sw_path,'sw.js',mimetype='application/javascript')
    resp.headers['Service-Worker-Allowed']='/'
    return resp
@app.route('/youtube')
def youtube_page():
    return render_template('youtube.html')
@app.route('/weather')
def weather_page():
    return redirect('/weather/web/weather')
@app.route('/radio')
def radio_page():
    return render_template('radio.html')
@app.route("/gemini")
def gemini_page():
    return render_template('gemini.html')


if __name__=="__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)