from flask import Blueprint,request,jsonify,Response
import requests

weather=Blueprint('weather',__name__)

@weather.route('/weather')
def get_weather():
    url='https://www.jma.go.jp/bosai/forecast/data/forecast/400000.json'
    try:
        resp=requests.get(url,timeout=5)
        resp.raise_for_status()
        return jsonify(resp.json())
    except requests.RequestException as e:
        return jsonify({'error':'Failed to fetch weather data'}),500
