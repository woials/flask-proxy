from datetime import timedelta
from dotenv import load_dotenv
from flask import Flask, flash,render_template,redirect, request, session,url_for,send_from_directory
from blueprint.youtube import youtube
from blueprint.weather import weather
# from blueprint.radio import radio
from blueprint.gemini import gemini
from blueprint.news import news
from flask_compress import Compress
from flask_login import LoginManager,UserMixin,login_user,login_required,logout_user,current_user
from werkzeug.security import generate_password_hash,check_password_hash
import os

app = Flask(__name__)
Compress(app)
app.register_blueprint(youtube, url_prefix='/youtube')
app.register_blueprint(weather,url_prefix='/weather')
# app.register_blueprint(radio,url_prefix='/radio')
app.register_blueprint(gemini,url_prefix='/gemini')
app.register_blueprint(news,url_prefix='/news')
basedir=os.path.dirname(os.path.abspath(__file__))
load_dotenv()
SECRET_KEY=os.getenv("SECRET_KEY")
app.config['SECRET_KEY']=SECRET_KEY
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,   # HTTPS限定
    SESSION_COOKIE_SAMESITE='Lax'
)

# *** ログイン関係の処理 ***
login_manager=LoginManager()
login_manager.init_app(app)
login_manager.login_view="login" #ログインしていない時のリダイレクト先
users={"aki":{"password":generate_password_hash("Mamesiba11")}}
app.config['REMEMBER_COOKIE_DURATION']=timedelta(days=365)

class User(UserMixin): #UserMixinを使うと、ログイン確認・アカウント有効判定・ゲストユーザー判定・ユーザに対応する一意のID割り振りを自動で行う
    def __init__(self,id):
        self.id=id

@login_manager.user_loader
def load_user(user_id):
    if user_id not in users: #IDが異なればNoneを返す
        return None
    return User(user_id)

# *** ルーティング ***
@app.before_request
def login_require_for_all_pages():
    allowed_endpoints=['login','static']
    session.permanent=True
    app.config['PERMANENT_SESSION_LIFETIME']=timedelta(days=365)
    # 今のユーザがログインしていない　＆　loginページ以外にアクセスしようとしている　➡ログインページへリダイレクト
    # is_authenticatedはUserMixinに入っているメソッド
    if not current_user.is_authenticated and request.endpoint not in allowed_endpoints:
        return redirect(url_for('login'))

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method=='POST':
        username=request.form.get('username')
        password=request.form.get('password')
        require_remember=request.form.get('remember')=='on'
        # usernameがusersにあるか　＆　usersにあるusernameに該当するpasswordと入力された文字列が同じか
        if username in users and check_password_hash(users[username]['password'],password):
            user=User(username)
            login_user(user,remember=require_remember)
            return redirect(url_for('index'))
        flash("ログインに失敗しました")
        
    param={"css_url":url_for('static',filename='css/login.css')}   
    return render_template('login.html',**param)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/home')
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

@app.route("/server_cache")
def server_cache_page():
    return render_template('server_cache.html')

@app.route("/news")
def news_page():
    return render_template('news.html')

if __name__=="__main__":
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)