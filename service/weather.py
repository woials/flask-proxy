import requests
from flask import request,jsonify,Response


def get_weather():
    url='https://www.jma.go.jp/bosai/forecast/data/forecast/400000.json'
    resp=requests.get(url,timeout=5)
    resp.raise_for_status()
    data=resp.json()

    target_area_code="400030"
    weather=None#pythonにおけるNULL　NULLはPythonにはない

    #timeSeriesの0番目にエリアごとの天気テキストが入っている
    for area_data in data[0]['timeSeries'][0]['areas']:
        if area_data['area']['code']==target_area_code:
            weather=area_data
            break
    
    if weather:
        today_icon,today_ascii_art=weather_to_icon(weather['weathers'][0])
        tomorrow_icon,tomorrow_ascii_art=weather_to_icon(weather['weathers'][1])
        weather_data={
            "area":"筑豊地方",
            "today":{
                "text":weather['weathers'][0],
                "icon":today_icon,
                "ascii":today_ascii_art
                },
            "tomorrow":{
                "text":weather['weathers'][1],
                "icon":tomorrow_icon,
                "ascii":tomorrow_ascii_art
                }
        }
        return weather_data
    else:
        return None
def get_weather_summary():
    url="https://www.jma.go.jp/bosai/forecast/data/overview_forecast/400000.json"
    resp=requests.get(url,timeout=5)
    resp.raise_for_status()
    data=resp.json()
    text=None
    if data['text']:
        text=data['text']
        summary={
            "text":text
        }
        return summary
    else:
        return None
    
ASCII_ICONS={
        "sunny":"""  | /
― O ―
  / | 
""",
        "cloudy":""" @@@@
 @@@@@@
 @@@@
""",
        "rainy": """ @@@@
 @@@@@@
  \\ \\
  \\ \\
""",
        "snowy":""" @@@@
 @@@@@@
   * *
  *   *
"""
    }
def weather_to_icon(weather_text):
    icon=None
    if "雪" in weather_text:
        icon="snowy"
    elif "雨" in weather_text:
        icon="rainy"
    elif "くもり" in weather_text:
        icon="cloudy"
    elif "晴れ" in weather_text:
        icon="sunny"
    else:
        icon=None
    
    if icon:
        return icon,ASCII_ICONS[icon]
    else:
        return None
    
    
    