import requests
from flask import request,jsonify,Response
from datetime import datetime,timedelta
from time import time
from enum import Enum
import math
weather_cache=None
weather_summary_cache=None
weather_cache_time=None
weather_summary_cache_time=None

amedas_code_cache=None
amedas_json_cache=None

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
    weekly_forecast=get_weekly_weather(data)
    amedas_code=get_amedas_code()
    amedas_json,used_time=get_amedas_json()
    station=get_station_data(amedas_json,amedas_code)
    temp=get_current_temp(station)
    humidity=get_humidity(station)
    precip10m=get_precipitation_10minutes(station)
    precip1h=get_precipitation_1h(station)
    wind=get_wind(station)
    sun10m=get_sun_10minutes(station)
    sun1h=get_sun_1h(station)
    
    if used_time:
        fetched_time=used_time.strftime("%H時%M分")
    
    #天気テキスト取得
    target_area_code="400030"
    weather=None#pythonにおけるNULL　NULLはPythonにはない
    #timeSeriesの0番目にエリアごとの天気テキストが入っている
    for area_data in data[0]['timeSeries'][0]['areas']:
        if area_data['area']['code']==target_area_code:
            weather=area_data
            break
    #予報とアメダスとを比較して、予報と違う場合は特殊テキストを表示
    today_forecast=weather['weathers'][0]
    advice=""
    #雨予報なのに降っていない
    if "雨" in today_forecast or "雪" in today_forecast:
        if precip10m==0:
            advice+="今は雨が止んでいます\n"
            if precip1h==0:
                advice+="1時間ほど雨は降っていないようです\n"
        else:
            advice=f"予報通り雨が降っています(直近10分:{precip10m}mm)\n"
    else: #雨予報でないのに降っている
        if precip10m>0:
            advice+=f"予報外の雨が降っています！(直近10分:{precip10m}mm)\n"
        
    #曇り予報なのに日差しがある
    if any(word in today_forecast for word in ["曇り","曇","くもり"]):  #"曇り","曇","くもり"のいずれかがあればtrue
        if sun10m>0.8:
            advice+="日差しが差してきました\n"
            if sun1h>0.8:
                advice+="予報より晴れているようです\n"
        # else:
        #     advice+="予報通り曇っています\n"
    elif any(word in today_forecast for word in ["晴れ","晴"]):
        if sun10m<0.3:
            advice+="予報より曇っているようです\n"
    #風の強さ
    if wind >10:
        advice+="強風に注意！\n"
    elif wind>5:
        advice+="風が吹いています\n"
    else:
        advice+="風は穏やかです\n"
    
    #不快指数と体感温度
    di=None
    di_text=""
    apparent_temp=None
    if temp is not None and humidity is not None and wind is not None:
        #不快指数
        di=round(0.81 * temp + 0.01 * humidity * (0.99 * temp - 14.3) + 46.3, 1)
        di_text=""
        if di<60:
            di_text="寒い"
        elif di<75:
            di_text="快適"
        elif di<85:
            di_text="暑い"
        else:
            di_text="暑すぎ！"
        if all(v is not None for v in [temp,humidity,wind]):  #すべての値がNoneでないことを確認
            e = (humidity / 100) * 6.105 * math.exp((17.27 * temp) / (237.7 + temp))
            #体感温度
            apparent_temp = round(temp + 0.33 * e - 0.7 * wind - 4.0, 1)
    
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
            if pop_value=="":
                pop_value="--"
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
            "amedas":{
                "fetched_time":fetched_time,
                "temp":temp,
                "humidity":humidity,
                "precip10m":precip10m,
                "precip1h":precip1h,
                "wind":wind,
                "di":di,
                "di_text":di_text,
                "apparent_temp":apparent_temp,
                "advice":advice
            },
            "weekly_forecast":weekly_forecast
            
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

def get_weekly_weather(data):
    WEATHER_CODE = {
    "100": "晴れ",
    "101": "晴れ時々曇り",
    "102": "晴れ一時雨",
    "103": "晴れ時々雨",
    "104": "晴れ一時雪",
    "105": "晴れ時々雪",
    "106": "晴れ一時雨か雪",
    "107": "晴れ時々雨か雪",
    "108": "晴れ一時雨か雷雨",
    "110": "晴れのち時々曇り",
    "111": "晴れのち曇り",
    "112": "晴れのち一時雨",
    "113": "晴れのち時々雨",
    "114": "晴れのち雨",
    "115": "晴れのち一時雪",
    "116": "晴れのち時々雪",
    "117": "晴れのち雪",
    "118": "晴れのち雨か雪",
    "119": "晴れのち雨か雷雨",
    "120": "晴れ朝夕一時雨",
    "121": "晴れ朝の内一時雨",
    "122": "晴れ夕方一時雨",
    "123": "晴れ山沿い雷雨",
    "124": "晴れ山沿い雪",
    "125": "晴れ午後は雷雨",
    "126": "晴れ昼頃から雨",
    "127": "晴れ夕方から雨",
    "128": "晴れ夜は雨",
    "130": "朝の内霧後晴れ",
    "131": "晴れ明け方霧",
    "132": "晴れ朝夕曇り",
    "140": "晴れ時々雨で雷を伴う",
    "160": "晴れ一時雪か雨",
    "170": "晴れ時々雪か雨",
    "181": "晴れのち雪か雨",
    "200": "曇り",
    "201": "曇り時々晴れ",
    "202": "曇り一時雨",
    "203": "曇り時々雨",
    "204": "曇り一時雪",
    "205": "曇り時々雪",
    "206": "曇り一時雨か雪",
    "207": "曇り時々雨か雪",
    "208": "曇り一時雨か雷雨",
    "209": "霧",
    "210": "曇りのち時々晴れ",
    "211": "曇りのち晴れ",
    "212": "曇りのち一時雨",
    "213": "曇りのち時々雨",
    "214": "曇りのち雨",
    "215": "曇りのち一時雪",
    "216": "曇りのち時々雪",
    "217": "曇りのち雪",
    "218": "曇りのち雨か雪",
    "219": "曇りのち雨か雷雨",
    "220": "曇り朝夕一時雨",
    "221": "曇り朝の内一時雨",
    "222": "曇り夕方一時雨",
    "223": "曇り日中時々晴れ",
    "224": "曇り昼頃から雨",
    "225": "曇り夕方から雨",
    "226": "曇り夜は雨",
    "228": "曇り昼頃から雪",
    "229": "曇り夕方から雪",
    "230": "曇り夜は雪",
    "231": "曇り海上海岸は霧か霧雨",
    "240": "曇り時々雨で雷を伴う",
    "250": "曇り時々雪で雷を伴う",
    "260": "曇り一時雪か雨",
    "270": "曇り時々雪か雨",
    "281": "曇りのち雪か雨",
    "300": "雨",
    "301": "雨時々晴れ",
    "302": "雨時々止む",
    "303": "雨時々雪",
    "304": "雨か雪",
    "306": "大雨",
    "308": "雨で暴風を伴う",
    "309": "雨一時雪",
    "311": "雨のち晴れ",
    "313": "雨のち曇り",
    "314": "雨のち時々雪",
    "315": "雨のち雪",
    "316": "雨か雪のち晴れ",
    "317": "雨か雪のち曇り",
    "320": "朝の内雨のち晴れ",
    "321": "朝の内雨のち曇り",
    "322": "雨朝晩一時雪",
    "323": "雨昼頃から晴れ",
    "324": "雨夕方から晴れ",
    "325": "雨夜は晴",
    "326": "雨夕方から雪",
    "327": "雨夜は雪",
    "328": "雨一時強く降る",
    "329": "雨一時みぞれ",
    "340": "雪か雨",
    "350": "雨で雷を伴う",
    "361": "雪か雨のち晴れ",
    "371": "雪か雨のち曇り",
    "400": "雪",
    "401": "雪時々晴れ",
    "402": "雪時々止む",
    "403": "雪時々雨",
    "405": "大雪",
    "406": "風雪強い",
    "407": "暴風雪",
    "409": "雪一時雨",
    "411": "雪のち晴れ",
    "413": "雪のち曇り",
    "414": "雪のち雨",
    "420": "朝の内雪のち晴れ",
    "421": "朝の内雪のち曇り",
    "422": "雪昼頃から雨",
    "423": "雪夕方から雨",
    "425": "雪一時強く降る",
    "426": "雪のちみぞれ",
    "427": "雪一時みぞれ",
    "450": "雪で雷を伴う",
}
    weekly_forecast=[]
     #週間天気予報は福岡県全体ででる
    weekly_data = data[1]  # 2つ目のオブジェクトが週間予報

    # 天気・降水確率のデータ
    weather_series = weekly_data['timeSeries'][0]
    time_defines = weather_series['timeDefines']
    area_data = weather_series['areas'][0]  # 福岡県のデータ

    # 今日と明日を除外（3日目以降を取得）
    forecast_days = time_defines[2:]  # インデックス2以降（3日目から）
    for i, day in enumerate(forecast_days):
        idx=2+i
        dt=datetime.fromisoformat(day)
        formatted_day=f"{dt.month}月{dt.day}日"
        # 天気コードと降水確率データ
        weather_codes = area_data['weatherCodes'][idx] if area_data['weatherCodes'][idx] != "" else "--"
        weather_text=WEATHER_CODE.get(weather_codes,"不明")
        pops = area_data['pops'][idx] if area_data['pops'][idx] != "" else "--"
        reliabilities = area_data['reliabilities'][idx] if area_data['reliabilities'][idx] != "" else "--"

        # 気温データ
        temp_series = weekly_data['timeSeries'][1]
        temp_area_data = temp_series['areas'][0]

        temps_min = temp_area_data['tempsMin'][idx] if temp_area_data['tempsMin'][idx] != "" else "--"
        temps_max = temp_area_data['tempsMax'][idx] if temp_area_data['tempsMax'][idx] != "" else "--"

        weekly_forecast.append({
            "date": formatted_day,
            "weather": weather_text,
            "weekly_pop": pops,
            "reliability": reliabilities,
            "temp_min": temps_min,
            "temp_max": temps_max
        })
    return weekly_forecast
        

def get_amedas_code():
    global amedas_code_cache
    area="飯塚"
    url="https://www.jma.go.jp/bosai/amedas/const/amedastable.json"
    try:
        resp=requests.get(url,timeout=5)
        resp.raise_for_status()
        data=resp.json()
    except requests.RequestException:
        if amedas_code_cache is not None:  #0や空文字もはじくようにする
            return amedas_code_cache
        raise
    amedas_code=next(
        (k for k,v in data.items()
        if v.get("kjName")==area),
        None)
    
    amedas_code_cache=amedas_code
    return amedas_code
        

def get_amedas_json():
    global amedas_json_cache
    
    now=datetime.now()
    minute=(now.minute//10)*10 #10分単位に切り下げ
    rounded=now.replace(minute=minute,second=0,microsecond=0)
    
    candidates=[
        rounded,
        rounded-timedelta(minutes=10)
    ]
    
    for used_time in candidates:
        ts=used_time.strftime("%Y%m%d%H%M%S")
        try:
            url=f"https://www.jma.go.jp/bosai/amedas/data/map/{ts}.json"
            resp=requests.get(url,timeout=5)
            resp.raise_for_status()
            data=resp.json()
            return data,used_time
        except requests.RequestException:
            continue  #今の１０分のデータが取れなかったらcontinueして次のfor文を回す
    return None,None

def get_station_data(json_data,code):
    if json_data is None:
        return None
    code=str(code)
    
    return json_data.get(code,None)

def get_humidity(station):
    if station is None:
        return None
    return station.get("humidity",[None])[0]
"""
〇json_data[code].get("humidity",[None])[0]
dict.get(key,default)は
キーがあればその値を返す、なければdefaultを返すというメソッド
上のコードだと、humidityがあれば値を返し、なければ[None]を返す
もし[None]ではなくNoneだと
None[0]->TypeError
[None]にすることで
[None][0]->None  となる。例外は出ず”値が取得できなかった”ことを表現できる
""" 

def get_current_temp(station):
    if station is None:
        return None
    return station.get("temp",[None])[0]
def get_precipitation_10minutes(station):
    if station is None:
        return None
    return station.get("precipitation10m",[None])[0]
def get_precipitation_1h(station):
    if station is None:
        return None
    return station.get("precipitation1h",[None])[0]
def get_wind(station):
    if station is None:
        return None
    return station.get("wind",[None])[0]
def get_sun_10minutes(station):
    if station is None:
        return None
    return station.get("sun10m",[None])[0]
def get_sun_1h(station):
    if station is None:
        return None
    return station.get("sun1h",[None])[0]
    
