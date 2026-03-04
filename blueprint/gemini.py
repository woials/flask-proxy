from flask import Blueprint,request,jsonify,Response,url_for,render_template
import requests

gemini=Blueprint('gemini',__name__)
from service.gemini_result import get_gemini_result

@gemini.route('/ask',methods=['POST'])
def gemini_page():
    data=request.get_json()
    query=data.get('query')
    result=get_gemini_result(query)
    return jsonify(result.model_dump())