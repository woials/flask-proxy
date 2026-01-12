from flask import Flask,render_template
from blueprint.youtube import youtube

app = Flask(__name__)
app.register_blueprint(youtube, url_prefix='/youtube')

@app.route('/')
def index():
    return render_template('index.html')
@app.route('/youtube')
def youtube_page():
    return render_template('youtube.html')
@app.route('/weather')
def weather_page():
    return render_template('weather.html')
if __name__=="__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)