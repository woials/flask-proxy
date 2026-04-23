"use strict";
// グローバル変数群
var cached_entries = {};
var client_width = document.documentElement.clientWidth;
var isPC= client_width >= 800; //PCかどうかを判定するフラグ
var active_element_menu = null; 
var active_element_entry = null;

// イベントリスナー群
window.addEventListener('DOMContentLoaded', function () {
    if (window.location.hash) {
        history.replaceState("", document.title, window.location.pathname);
    }
    getRSSFeed();
});
window.addEventListener('hashchange', function () {
    var raw_hash = decodeURIComponent(window.location.hash); //例: #FBSが取得できる
    
    var parts = raw_hash.split('/'); //例: #FBS/0のようにスラッシュで分割して配列にする。parts[0]は#FBS、parts[1]は0になる。
    var part = parts[0];
    var sourceName = part.substring(1); //例: #FBS/0の#を取り除いてFBSだけを取得
    if (!raw_hash) {//例: #がない場合
        createNewsSources(Object.keys(cached_entries));
        return;
    }
    if (raw_hash.indexOf("/") !== -1) { //例: #FBS/0のようにスラッシュがある場合

        var index = parseInt(parts[1]);
        if (cached_entries[sourceName] && cached_entries[sourceName][index]) {
            getArticle(cached_entries[sourceName][index].link);
        }
    } else {//例: #FBSのようにスラッシュがない場合
        createNewsTitles(sourceName);
    }

});

window.addEventListener('resize', function () {
    client_width= document.documentElement.clientWidth;
    isPC= client_width >= 800;
});

// 関数群
function getRSSFeed() {
    var url = "news/api/top"
    xhrGetJSON(url, function (err, data) {
        if (err) {
            console.error('Error fetching RSS feed:', err);
            return;
        } else {
            cached_entries = data;
            var news = document.getElementById("news");
            var sourceNames = Object.keys(data);
            news.innerHTML = "";
            createNewsSources(sourceNames);
        }

    });
}

//記事の内容を取得して表示する関数
function getArticle(link) {
    var url = "/news/api/article?q=" + encodeURIComponent(link);
    var news = document.getElementById("news-list");
    
    var articleSection = document.getElementById("article");
    if (!isPC) {
        news.innerHTML = "Loading...";
        articleSection.innerHTML = "";
    }
    xhrGetJSON(url, function (err, data) {
        if (err) {
            console.error("Error fetching article:", err);
            news.innerHTML = "Failed to load article.";
            return;
        } else {
            // innerHTMLで本文を構築した後に、setTimeoutでブラウザの描画を待った後で
            // window.scrollToで画面上部までスクロールする
            var paragraph = data.article.split("\n\n"); // \n\nで分解して段落ごとにする
            articleSection.innerHTML = paragraph.map(function (p) {
                var lines=p.split("\n");
                return "<p class='dotgothic16-regular'>" + lines.join("<br>") + "</p>"; //段落ごとに<p>タグで囲む
            }).join("");//段落を結合して表示
            if (!isPC) {
            news.innerHTML = "";
            }
            setTimeout(function(){
                window.scrollTo({
                    top:0,
                    behavior:"instant"
                });
            },0);
        }
    });
}

//ニュースのソースを表示する関数
function createNewsSources(sourceNames) {
    var news = document.getElementById("news");
    news.innerHTML = "";
    for (var i = 0; i < sourceNames.length; i++) {
        var div = document.createElement("div");
        div.className = "news-source";
        var a = document.createElement("a");
        a.textContent = sourceNames[i];
        a.href = "#" + sourceNames[i];
        div.style.cursor = "pointer";
        div.addEventListener("click",function(e){
            e.preventDefault();
            window.location.hash=this.querySelector("a").textContent; //例: #FBS
            if(active_element_menu){
                active_element_menu.classList.remove("active");
            }
            this.classList.add("active");
            active_element_menu=this;
        })
        div.appendChild(a);
        news.appendChild(div);
    }
}
//ニュースのタイトルを表示する関数
function createNewsTitles(sourceName) {
    var news = document.getElementById("news-list");
    var articleSection = document.getElementById("article");
    articleSection.innerHTML = ""; //記事の内容を消す
    news.innerHTML = "";
    var entries = cached_entries[sourceName];
    if (entries !== undefined) {
        for (var i = 0; i < entries.length; i++) {
            (function (index) {
                var entry = entries[index];
                var li = document.createElement("li");
                li.className = "news-entry";
                li.style.cursor = "pointer";
                var a = document.createElement("a");
                a.textContent = entry.title + " (" + entry.pub_date + ")";
                a.href = "#" + sourceName + "/" + index; //例: #FBS/0

                li.appendChild(a);
                news.appendChild(li);
                li.addEventListener("click", function (e) {
                    if(active_element_entry){
                        active_element_entry.classList.remove("active");
                    }
                    this.classList.add("active");
                    active_element_entry=this;
                    e.preventDefault();
                    window.location.hash=sourceName + "/" + index; //例: #FBS/0
                });
            })(i);
        }
    } else {
        createNewsSources(Object.keys(cached_entries));
    }
}

/* 返って来るjsonの構造
    {
    放送局名:[
        {
            リンク,
            日時,
            タイトル
        },
    ]
    }
*/














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
