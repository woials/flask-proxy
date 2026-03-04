"use strict";
function ask(){
    var query = document.getElementById('searchBox').value;
    if(!query) return;
    document.getElementById('question').textContent=query;
    var url="/gemini/ask";
    xhrPostJSON(url,{query:query},function(error,data){
        if(error){
            console.log(error);
            return;
        }else{
            createHTML(data);
        }
    })

}

function createHTML(data){
    document.getElementById("title").textContent=data.title;
    document.getElementById("summary").textContent=data.summary;
    var main_container=document.getElementById('main');
    if(main_container.childElementCount>0){
        main_container.innerHTML=""
    }
    for(var i=0; i<data.main_text.length; i++){
        var block=data.main_text[i]
        var element=null;
        if(block.type === 'headline'){
            element=document.createElement('h2');
        }else if(block.type === 'paragraph'){
            element=document.createElement('p');
        }
        element.textContent=block.text;
        main_container.appendChild(element)
    }
}

//---------------------------------------------------------------------------//
// GET用のヘルパー関数
function xhrGetJSON(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function () {
        if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
                    callback(null, data);
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                    callback(new Error('Failed to parse JSON'));
                }
            } else {
                callback(new Error('Failed to fetch data: ' + xhr.status));
            }
        }
    };
    xhr.onerror = function () {
        callback(new Error('Network error'));
    };
    xhr.send(null);
}

// POST用のヘルパー関数
function xhrPostJSON(url, body, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            var json = null;
            if (xhr.responseText) {
                try {
                    json = JSON.parse(xhr.responseText);
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                }
            }
            callback(null, json);
        } else {
            callback(new Error('Failed to post data: ' + xhr.status));
        }
    };
    xhr.onerror = function () { callback(new Error("network error")); }
    xhr.send(JSON.stringify(body));
}

window.app={
    ask:ask
}