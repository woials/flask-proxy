from flask import Blueprint,request,jsonify,Response,url_for,render_template
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
    params={
    "css_url":url_for('static',filename='css/weather.css'),
    "area":weather_data["area"],
    "today":weather_data["today"],
    "tomorrow":weather_data["tomorrow"],
    "summary":weather_summary_data["text"],
    "precip_chances":weather_data["precip_chances"],
    "amedas":weather_data["amedas"],
    "weekly_forecast":weather_data["weekly_forecast"]
    }
    return render_template('weather.html',**params)  #**をつけると辞書のキーが変数名として格納される

"""
〇位置引数とキーワード引数

位置引数：変数の位置で判断する
Cの例
void calc(int x,int y){
    int result=(x+1)-(y+3);
    return result;
}
xとyの位置を間違えると望んだ結果が得られない
ex)x=2,y=3 → 3-6=-3
   これを入れ替えると 4-5=-1

キーワード引数:変数の名前で判断する
swiftの例
func greet(person:String,from hometown:String){
    print("Hello\(person)! Glat you could visit from \(hometown).")
}
greet(person:"Tanaka",from:"Fukuoka")
呼び出すときに名前を書かないとエラーになる
言い換えると、名前を明示的に指定することで、引数の入れ替えミスなどを防ぐことができる
"""