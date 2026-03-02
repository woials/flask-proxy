from flask import Blueprint,request,jsonify,Response,url_for,render_template
import requests

gemini=Blueprint('gemini',__name__)
from service.gemini_result import get_gemini_result

@gemini.route('/web/gemini')
def gemini_page():
    result=get_gemini_result()
    params={
        "gemini_result":result
    }
    return render_template('gemini.html',**params)