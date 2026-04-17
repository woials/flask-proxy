"use strict";
var isSent = false;
function ask() {
    if (isSent) return;
    var searchBox = document.getElementById('searchBox')
    var query = document.getElementById('searchBox').value;
    if (!query) return;
    var option = document.getElementById('mode-select').value;
    searchBox.value = "";
    searchBox.style.height = 'auto';
    isSent = true;
    drawBorder_forQuestion(query);
    var url = "/gemini/ask";

    if (isSent) {
        document.getElementById('title').textContent = "";
        document.getElementById('summary').textContent = "";
        document.getElementById('main').textContent = "";
        xhrPostJSON(url, { query: query, option: option }, function (error, data) {
            isSent = false;
            if (error) {
                console.log(error);
                return;
            } else {

                createHTML(data);
            }
        })
    }
}

var tx = document.getElementById('searchBox');
tx.addEventListener('input', function () {
    tx.style.height = 'auto';
    tx.style.height = tx.scrollHeight + 'px';
})

tx.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        if (e.shiftKey || e.isComposing) {
            return;
        }
        e.preventDefault();
        ask();
    }
})

function drawBorder_forQuestion(query) {
    var question = document.getElementById('question');
    question.textContent = query;
    question.style.display = 'inline-block'
    question.style.maxWidth = 'calc(100% - 20px)'
    question.style.textAlign = 'left'
    question.style.padding = '8px'
    question.style.boxSizing = 'border-box'
    question.style.border = '1px solid #ddd';
    question.style.borderRadius = '4px';
    question.style.backgroundColor = '#007aff'
    question.style.color = 'white';
    question.style.border = 'none';
}

function createHTML(data) {
    document.getElementById("title").textContent = data.title;
    document.getElementById("summary").textContent = data.summary;
    var main_container = document.getElementById('main');
    if (main_container.childElementCount > 0) {
        main_container.innerHTML = ""
    }
    for (var i = 0; i < data.main_text.length; i++) {
        var block = data.main_text[i]
        var element = null;
        if (block.type === 'headline') {
            element = document.createElement('h2');
        } else if (block.type === 'paragraph') {
            element = document.createElement('p');
        }
        element.textContent = block.text;
        main_container.appendChild(element)
    }
}

var modal = document.getElementById('setting-modal');
function openModal() {
    modal.style.display = 'block';
}
function closeModal() {
    modal.style.display = 'none';
}
window.onclick = function (event) {
    if (event.target == modal) {
        closeModal();
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

window.app = {
    ask: ask,
    openModal: openModal
}