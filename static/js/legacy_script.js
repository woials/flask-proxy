// 古いブラウザ向けのjavascriptコード
// constやletはサポートされていないのでvarを使用する
// また、async/awaitもサポートされていない可能性があるため、Promiseを使用して非同期処理を行う
// さらに、fetchもサポートされていない可能性があるため、XMLHttpRequestを使用してHTTPリクエストを行う
"use strict";


function search() {
    var query = document.getElementById('searchBox').value;
    var url = "/youtube/search?q=" + encodeURIComponent(query);
    var videos = null;
    if (!query) return;
    /*URI:Uniform Resource Identifier
    リソースを一意に識別するためのデータ形式 URLやスキーム名(https)
    encodeURIComponent()はURI内で扱えない文字(非ASCII文字、スペース、/?&=#:@など)をエスケープする
    %と16進数でエスケープシーケンスとして表現する
    主にクエリパラメータ(URLの?以降の部分)の値をエンコードするときに使う*/

    xhrGetJSON(url, function (error, data) {
        if (error) {
            console.error('Search failed:', error);
            return;
        } else {
            videos = data;
            document.getElementById('slidebarTitle').textContent = "検索結果";
            displayVideos(videos);
        }
    })
}


function displayVideos(videos) {
    var resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    videos.forEach(function (v) {
        resultsDiv.appendChild(createVideoItem(v));
    })
}

function createVideoItem(v) {
    var item = document.createElement('div');
    item.className = 'video-item';

    item.addEventListener('click', function () {
        app.fetchVideo(
            v.videoId,
            v.title,
            v.description || '',
            v.uploader || '',
            v.thumbnailURL,
            v.duration
        );
    });


    item.innerHTML =
        '<img src="' + v.thumbnailURL + '" alt="Thumbnail of ' + v.title + '">' +
        '<div class="video-details">' +
        '<h3>' + v.title + '</h3>' +
        '<small>' + (v.uploader || '不明') + '</small>' +
        '<small>' + formatViews(v.view_count) + '回視聴</small>' +
        '<p class="duration">' + formatDuration(v.duration) + '</p>' +
        '</div>';
    return item;
}
function formatViews(count) {
    if (!count) return '0';
    return count.toLocaleString();
}
function formatDuration(sec) {
    var min = Math.floor(sec / 60);
    var s = sec % 60;
    s = s < 10 ? '0' + s : s;
    return min + ":" + s;
}

function fetchVideo(VideoId, title, description, uploader, thumbnailURL, duration) {
    showloading();
    var quality = document.getElementById('qualitySelect').value;
    var url = "/youtube/stream/" + VideoId;
    // 画質の取得、動画ダウンロードのリクエストをサーバーに送信
    xhrPostJSON(url, { quality: quality,title:title }, function (error, data) {
        if (error || !data) { // dataがnullのときもエラーとみなす
            console.error("POST失敗:", error);
            return;
        }

        var timer = null;
        var played = false;
        function checkStatus() {
            xhrGetJSON('/youtube/status/' + VideoId, function (error, json) {
                if (error) {
                    setTimeout(checkStatus, 1000); // 1秒後に再度チェック
                    return;
                }
                if (json && json.ready) {
                    if (!played) {
                        played = true;
                        clearTimeout(timer);
                        deleteloading();
                        play(VideoId, quality, title, uploader, thumbnailURL, description, duration);
                    }
                    return;
                }else if(json && json.status === "error") {
                    alert("ダウンロードに失敗しました");
                    return;
                } else {
                    timer = setTimeout(checkStatus, 1000); // 1秒後に再度チェック
                }
            })
        }
        checkStatus();
    });
}
function play(VideoId, quality, title, uploader, thumbnailURL, description, duration) {
    var playersection = document.getElementById('playerSection');
    var target = null;
    playersection.classList.remove('hidden');
    //動画情報を表示
    document.getElementById('videoTitle').textContent = title;
    document.getElementById('videoUploader').textContent = uploader || "";
    document.getElementById('videoDescription').textContent = description || "";

    //動画読み込み
    var videoPlayer = document.getElementById('videoPlayer');
    var audioPlayer = document.getElementById('audioPlayer');
    if (quality !== '128' && quality !== '48') { //動画の場合
        audioPlayer.classList.add('hidden');
        videoPlayer.classList.remove('hidden');
        audioPlayer.pause();
        audioPlayer.src = '';
        videoPlayer.src = 'youtube/video/' + VideoId;
        target = videoPlayer;
    } else { //音声のみの場合
        videoPlayer.classList.add('hidden');
        audioPlayer.classList.remove('hidden');
        videoPlayer.pause();
        videoPlayer.src = '';
        audioPlayer.src = 'youtube/video/' + VideoId + '?audio=1';
        target = audioPlayer;
    }

    function onCanPlay() {
        target.removeEventListener('canplay', onCanPlay);
        try {
            target.play();
        } catch (e) {
            console.error('再生エラー:', e);
        }

    }
    target.oncanplay = null;
    target.addEventListener('canplay', onCanPlay);
    target.onerror = function (e) { console.error('再生エラー:', e) };
    loadRelatedVideos(VideoId);

}
function loadRelatedVideos(videoId) {
    document.getElementById('slidebarTitle').textContent = '関連動画';

    var response = xhrGetJSON('/youtube/related/' + videoId, function (error, data) {
        if (error) {
            console.error('関連動画の取得に失敗:', error);
            return;
        } else {
            var videos = data;
            // 現在の動画を除外
            var filtered = videos.filter(function (v) { return v.id !== videoId; });
            displayVideos(filtered);
        }
    });
}

function showloading() {
    var video_info = document.getElementById('video-info');
    var video_info_css = document.querySelector('.loading-bar');
    video_info.classList.remove('hide');
    video_info.classList.add('show');
    video_info_css.style.backgroundColor = "rgba(0,255,255,0.5)";
    video_info.textContent = "準備中...";
    //return new Promise(function(r){requestAnimationFrame(r)});
}

function deleteloading() {
    var video_info = document.getElementById('video-info');
    var video_info_css = document.querySelector('.loading-bar');
    video_info.classList.remove('show')
    video_info.classList.add('hide');
    video_info.textContent = "";
    video_info_css.style.backgroundColor = "rgba(0,255,255,0.5)";
    //return new Promise(r => requestAnimationFrame(r));
}

document.getElementById('search').addEventListener('click', function () {
    search();
});
document.querySelector('.toggleoption').addEventListener('click', function () {
    var options = document.querySelector('.options');
    options.classList.toggle('show');
});
document.querySelector('.cache-option').classList.add('hidden');
document.querySelector('.stored-video').classList.add('hidden');
document.querySelector('.drop-table').classList.add('hidden');
var audio_setting = document.getElementById('AudioOption');
audio_setting.addEventListener('change', function () {
    var title = document.getElementById('quality_title');
    var options = document.getElementById('qualitySelect');
    var audio_settings = [
        { val: '128', text: '128kbps' },
        { val: '48', text: '48kbps' }
    ]
    var video_settings = [
        { val: '144', text: '144p' },
        { val: '240', text: '240p' },
        { val: '360', text: '360p' },
        { val: '480', text: '480p' },
        { val: '720', text: '720p' },
        { val: '1080', text: '1080p' },
    ]
    if (audio_setting.checked) {
        title.textContent = "音質設定";
        options.innerHTML = audio_settings.map(function (d) {
            return '<option value=' + d.val + '>' + d.text + '</option>';
        }).join('');
    } else {
        title.textContent = "画質設定";
        options.innerHTML = video_settings.map(function (d) {
            return '<option value=' + d.val + '>' + d.text + '</option>';
        }).join('');
    }
});

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

/* callbackについて
コールバック関数は、非同期処理が完了したときに呼び出される関数。
function xhrGetJSON(url, callback)
この場合、URLからJSONデータを取得する非同期処理が完了したときに、callback関数が呼び出される。
なので、
var data=xhrGetJSON(url);みたいなかんじで書いても、dataには非同期処理の結果が入らない。
通信が終わる前に関数が終わるから何も返せるものがないため。
そこで、
xhrGetJSON(url, function(err, data){
    // ここは「通信が終わった未来」
});
このように、xhrGetJSONの第二引数にコールバック関数を渡すことで、通信が終わったときにその関数が呼び出されるようになる。
コールバック関数で、
xhrGetJSON(url,function(error,data){
        if(error){
            console.error('Search failed:',error);
            return;
        }else{
            videos=data;
            document.getElementById('slidebarTitle').textContent = "検索結果";
            displayVideos(videos);
        }
    })
このように書くと、通信が終わったときに、もしエラーがあればエラーをログに出力し、
そうでなければ取得したデータをvideosに格納し、スライドバーのタイトルを「検索結果」に変更し、displayVideos関数を呼び出して動画を表示することができる。
つまり、
1.xhrGetJSON/xhrPostJSONでurlに対してリクエストを送信
2.通信が終わると、コールバック関数が呼び出される
3.コールバック関数内で、エラーがあればエラーを処理し、そうでなければ取得したデータを処理する
このように記述することで、fetchやasync/awaitがサポートされていない環境でも、非同期処理を行うことができる。
さらに、コールバック関数は”ある処理が終了したら、次に何をするかを渡す仕組み”なので、タイマーやイベント、ファイル読み込みにも使われることが多い。
*/

window.app = {
    search: search,
    fetchVideo: fetchVideo,
};