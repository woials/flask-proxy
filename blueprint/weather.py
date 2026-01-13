from flask import Blueprint,request,jsonify,Response,render_template
import requests
# 天気情報取得のサービスをインポート
from service.weather import get_weather,get_weather_summary
weather=Blueprint('weather',__name__)

@weather.route('/api/weather')#天気の情報を取得する共通処理
def api_weather():
    try:
        data=get_weather()
    except requests.RequestException:
        return jsonify({'error':'Failed to fetch weather data'}),500
    if data is None:
        return jsonify({'error':'Area not found'}),500
    return jsonify(data)
#@weather.route('/m5/weather')#M5Stack用の天気情報取得処理

@weather.route('/web/weather')#ブラウザ用の天気情報取得処理
def draw_weather():
    weather_data=get_weather()
    weather_summary_data=get_weather_summary()
    area=weather_data["area"]
    today=weather_data["today"]
    tomorrow=weather_data["tomorrow"]
    summary=weather_summary_data["text"]
    html=f"""
    <html>
        <head>
            <meta charset="utf-8">
            <title>天気</title>
            <link rel="stylesheet" href={{url_for('static',filename='css/weather.css')}}>
        </head>
        <body>
            <h1>{area}</h1>
            <h2>天気概況</h2>
            <p>{summary}</p>
            <section>
                <pre class="weather {today.get("icon")}">{today.get("ascii")}</pre>
                <p>今日の天気:{today.get("text")}</p>
            </section>
            <section>
                <pre class="weather {tomorrow.get("icon")}">{tomorrow.get("ascii")}</pre>
                <p>明日の天気:{tomorrow.get("text")}</p>
            </section>
            
        </body>
    </html>
    """
    return html