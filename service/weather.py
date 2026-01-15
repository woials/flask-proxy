import requests
from flask import request,jsonify,Response
from datetime import datetime
from time import time
from enum import Enum
weather_cache=None
weather_summary_cache=None
weather_cache_time=None
weather_summary_cache_time=None
humidity_cache=None
humidity_cache_time=None
CACHE_TTL=300  #5分
HUMIDITY_CACHE_TTL=60*60  #１時間


"""
関数の上にある変数はモジュールスコープ
扱い的にはCのstaticなグローバル変数に近い
weather.py内の関数から見えて、ほかの.pyからはimport weatherをしないと使えない
プロセスが生きている間は保持される
関数内でこの変数に代入するときglobalキーワードが必要になる(ローカル変数との区別のため)
一方で、この変数を参照するだけならglobalキーワードは不要
"""

def get_weather():
    global weather_cache,weather_cache_time  #ローカル変数ではなくグローバル変数であると宣言
    now=time()
    if weather_cache and now - weather_cache_time<CACHE_TTL:
        return weather_cache
    else:
        try:   
            url='https://www.jma.go.jp/bosai/forecast/data/forecast/400000.json'
            resp=requests.get(url,timeout=5)
            resp.raise_for_status()
            data=resp.json()
        except requests.RequestException:
            if weather_cache:
                return weather_cache
            raise  #例外を外に投げる
        
    temps=get_temp(data)
    #天気テキスト取得
    target_area_code="400030"
    weather=None#pythonにおけるNULL　NULLはPythonにはない
    #timeSeriesの0番目にエリアごとの天気テキストが入っている
    for area_data in data[0]['timeSeries'][0]['areas']:
        if area_data['area']['code']==target_area_code:
            weather=area_data
            break
    #降水確率取得
    pop_series=data[0]['timeSeries'][1]
    time_defines=pop_series['timeDefines']#timeSeriesのtimeDefinesは時間軸のリスト
    #エリアコードに一致するデータを探す
    """
    〇ジェネレータ式
    item for item in ... if ... という書き方
    条件に合うitemを1つずつ取り出す
    SQLのselect文に近いけど、SQLの場合は結果がセット(結果セット)で返って来るが、
    ジェネレータ式の場合はイテレータなので１つずつ返って来る
    """
    area_pop_data=next((item for item in pop_series['areas']
                        if item['area']['code']==target_area_code),None)
    today_pop=[]
    tomorrow_pop=[]

    if area_pop_data:
        current_time=datetime.now() #現在時刻を取得

        """
        enumerate() 列挙する、数え上げるという意味。enum(列挙型)の基になる単語
        この関数は中身のデータとインデックスをセットで取得できる
        timeDefines(時間のリスト)の0番目に対応しているのは0番目の降水確率
        timeDefines=0 i=0 area_pop_date['pops'][0]=0番目の降水確率
        わざわざカウント用の変数を作らなくてもいいので便利であり見た目もスッキリ！
        """

        for i,time_str in enumerate(time_defines):
            forecast_time=datetime.fromisoformat(time_str)
            pop_value=area_pop_data['pops'][i]
            display_time=forecast_time.strftime('%H:%M')#06:00のような表示になる
            if forecast_time.date()==current_time.date():
                today_pop.append({
                    "time":display_time,
                    "chance":pop_value  #キーの名前をpopにすると名前衝突[pop():辞書型から中身を取り出して削除する関数]したので変更
                })
            else:
                tomorrow_pop.append({
                    "time":display_time,
                    "chance":pop_value
                })

    if weather:
        today_icon,today_ascii_art=weather_to_icon(weather['weathers'][0])
        tomorrow_icon,tomorrow_ascii_art=weather_to_icon(weather['weathers'][1])
        weather_data={
            "area":"筑豊地方",
            "precip_chances":{
                "today":today_pop,
                "tomorrow":tomorrow_pop
            },
            "today":{
                "text":weather['weathers'][0],
                "max":temps["today"]["max"],
                "min":temps["today"]["min"],
                "icon":today_icon,
                "ascii":today_ascii_art
                },
            "tomorrow":{
                "text":weather['weathers'][1],
                "max":temps["tomorrow"]["max"],
                "min":temps["tomorrow"]["min"],
                "icon":tomorrow_icon,
                "ascii":tomorrow_ascii_art
                },
            
        }
        weather_cache=weather_data
        weather_cache_time=now
        return weather_data
    else:
        return None
    
def get_weather_summary():
    global weather_summary_cache,weather_summary_cache_time
    now=time()
    if weather_summary_cache and now - weather_summary_cache_time < CACHE_TTL:
        return weather_summary_cache
    else:
        try:
            url="https://www.jma.go.jp/bosai/forecast/data/overview_forecast/400000.json"
            resp=requests.get(url,timeout=5)
            resp.raise_for_status()
            data=resp.json()
        except requests.RequestException:
            if weather_summary_cache:
                return weather_summary_cache
            raise
        
    text=None
    if data['text']:
        text=data['text']
        summary={
            "text":text
        }
        weather_summary_cache=summary
        weather_summary_cache_time=now
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
  || ||
   || ||
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
        return icon,ASCII_ICONS.get(icon,"")
    else:
        return None
    
def get_temp(data):
    temp_series=data[0]['timeSeries'][2]
    time_defines=temp_series['timeDefines']
    target_temp_code="82136"
    area_temp_data=next((item for item in temp_series['areas'] 
                         if item['area']['code'] == target_temp_code),None)
    temps = {
        "today": 
            {"max": "--", "min": "--","details":[]},
        "tomorrow":
            {"max": "--", "min": "--","details":[]}
            }
    
    if area_temp_data:
        current_date=datetime.now().date()
        for time_str,temp in zip(time_defines,area_temp_data['temps']):
            if temp=="":
                continue
            
            date=datetime.fromisoformat(time_str)
            forecast_date=date.date()
            forecast_time=date.strftime('%H:%M')
            
            item={
                "time":forecast_time,
                "temp":temp,
            }
            
            #今日か明日かを判定
            if forecast_date==current_date:
                temps["today"]["details"].append(item)
            else:
                temps["tomorrow"]["details"].append(item)
            
    #最高気温・最低気温を抽出
    today_temp=[int(d["temp"]) for d in temps["today"]["details"] if d["temp"]!=""]
    tomorrow_temp=[int(d["temp"]) for d in temps["tomorrow"]["details"] if d["temp"]!=""]
    if today_temp:
            temps["today"]["max"]=max(today_temp)
            temps["today"]["min"]=min(today_temp)
    if tomorrow_temp:
            temps["tomorrow"]["max"]=max(tomorrow_temp)
            temps["tomorrow"]["min"]=min(tomorrow_temp)
    return temps
"""
〇today_temp=[
    int(d["temp"])
    for d in temps["today"]["details"]
    if d["temp"]!=""]
1)for d temps["today"]["details"]
今日の気温データを１件ずつ取り出してdに紐づける
2)if f["temp"]!=""
もしtempが空文字であれば結果から除外する
3)int(d["temp"])
気温のデータ(文字列)をintに変換
4)today_temp=[*intに変換した気温*]
変換したデータをリストに格納する
"""
"""
〇配列とリスト
リスト：中身の型に制限がない可変長の変数の参照の並び。ポインタ配列に近い
a=[1,"two",3.0]
配列：中身の型に制限がある可変長の変数の並び。メモリに連続して存在している。C配列に近い
from array import array
a=array("i",[1,2,3])  #iは型がsigned intであることを指定する
"""

def get_current_humidity():
    global humidity_cache,humidity_cache_time
    url="https://www.jma.go.jp/bosai/amedas/const/amedastable.json"
    try:
        resp=requests.get(url,timeout=5)
        resp.raise_for_status()
        data=resp.json()
    except requests.RequestException:
        if humidity_cache:
            return humidity_cache
        raise
    
    station_code="82136"
    
    if station_code in data:
        #観測データは[１時間前、５０分前、... 、最新]のように並んでいる
        humidity_list=data[station_code].get("humidity",[])
    for h in reversed(humidity_list):
        if h is not None:
            return h