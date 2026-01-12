import requests
from flask import request,jsonify,Response


def get_weather():
    url='https://www.jma.go.jp/bosai/forecast/data/forecast/400000.json'
    try:
        resp=requests.get(url,timeout=5)
        resp.raise_for_status()
    except requests.RequestException as e:
        return jsonify({'error':'Failed to fetch weather data'}),500
    results=resp.json()
    weather_data=[]
    root=results[0]
    ts=root["tumeSeries"][0]
    area=ts["areas"][2]
    weather=area["weathers"][0]

    weather_data={
        "today":{
            "area":area,
            "weather":weather,
        }
    }
    return jsonify(weather_data)