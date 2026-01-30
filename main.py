from flask import Flask,render_template,redirect,url_for,send_from_directory
from blueprint.youtube import youtube
from blueprint.weather import weather
from blueprint.radio import radio


app = Flask(__name__)
app.register_blueprint(youtube, url_prefix='/youtube')
app.register_blueprint(weather,url_prefix='/weather')
app.register_blueprint(radio,url_prefix='/radio')
@app.route('/')
def index():
    return render_template('index.html')
@app.route('/sw.js')
def serve_sw():
    return send_from_directory('static/js','sw.js',mimetype='application/javascript')
@app.route('/youtube')
def youtube_page():
    return render_template('youtube.html')
@app.route('/weather')
def weather_page():
    return redirect('/weather/web/weather')
@app.route('/radio')
def radio_page():
    return render_template('radio.html')

if __name__=="__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)