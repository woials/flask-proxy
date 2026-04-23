"use strict";

// グローバル変数
var video_count = 0;
var audio_count = 0;
var isVideo = true;
var isDeletable = false;
var currentVideoId = -1;
var video_list = [];
var countElement, video_item, allData;
var qualityPriority = document.getElementById('quality-priority');
var resultsContainer = document.getElementById('results');
var typeSelector = document.getElementById('video-type');
var deleteBtn = document.getElementById('delete');
var changeVideo = document.getElementById('video-type');
var changeAudio = document.getElementById('audio-type');

/*イベントリスナー群 */

// DOM構築時(HTMLの読み込み完了時)に実行する
window.addEventListener('DOMContentLoaded', function () {
    countElement = document.getElementById('count');
    get_count();
    fetchVideos();
})

qualityPriority.addEventListener('change', function () {
    resultsContainer.textContent = ''; // 表示をリセット
    displayVideos(allData); // 再描画
});


if (typeSelector) {
    typeSelector.addEventListener('change', function () {
        resultsContainer.textContent = ''; //表示をリセット
        isVideo = (this.value === 'video');
        update_count();
        fetchVideos();
    });
}

changeVideo.addEventListener('click', function () {
    resultsContainer.textContent = ''; //表示をリセット
    isVideo = true;
    update_count();
    fetchVideos();
});

changeAudio.addEventListener('click', function () {
    resultsContainer.textContent = ''; //表示をリセット
    isVideo = false;
    update_count();
    fetchVideos();
})

deleteBtn.addEventListener('click', function () {
    isDeletable = !isDeletable; //クリックするたびにフラグを反転

    var items = document.querySelectorAll('.video-item');
    for (var i = 0; i < items.length; i++) {
        if (isDeletable) {
            items[i].style.border = '2px solid orange';
            items[i].style.cursor = 'help';
        } else {
            items[i].style.border = '';
            items[i].style.cursor = 'pointer';
        }
    }
    this.textContent = isDeletable ? '削除モード:ON' : '削除モード:OFF';

});

document.addEventListener('DOMContentLoaded', () => {
    var settingsBtn = document.getElementById('settings');
    var settingsMenu = document.getElementById('settings-menu');
    var isshown = false;
    settingsBtn.addEventListener('click', function()  {
        // hiddenクラスを付け外しして表示/非表示を切り替える
        if (isshown) {
            settingsMenu.classList.remove('show');
            settingsMenu.classList.add('hidden');
            isshown=false;
        } else {
            settingsMenu.classList.remove('hidden');
            settingsMenu.classList.add('show');
            isshown=true;
        }

    });

    // メニュー外をクリックした時に閉じる処理（使い勝手向上のため）
    document.addEventListener('click', function(event)  {
        if (!settingsBtn.contains(event.target) && !settingsMenu.contains(event.target)) {
            settingsMenu.classList.remove('show');
            settingsMenu.classList.add('hidden');
        }
    });
});
/*関数群 */

function get_count() {
    var url = '/youtube/server/count';
    xhrGetJSON(url, function (error, data) {
        if (error) {
            console.error('Error fetching counts:', error);
        } else {
            video_count = data.video_count;
            audio_count = data.audio_count;
            update_count();
        }
    })
}

function update_count() {
    if (isVideo) {
        countElement.textContent = '動画: ' + video_count + '件';
    } else {
        countElement.textContent = '音声: ' + audio_count + '件';
    }
}



//動画・音声を表示する関数群

function fetchVideos() {
    var url = '/youtube/server/videos'
    xhrGetJSON(url, function (error, data) {
        if (error) {
            console.error('Error fetching videos:', error);
        } else {
            allData = data;
            displayVideos(data);
        }
    });

}

function displayVideos(data) {
    resultsContainer = document.getElementById('results');

    var videos = isVideo ? data.videos : data.audios;
    var keys = Object.keys(videos); // キー（ID）の配列を作る
    video_list = keys; //動画IDのリストを保存

    for (var i = 0; i < keys.length; i++) {
        var videoId = keys[i];
        (function (videoId) { //即時関数(IIFE)でスコープを作る
            var details = videos[videoId][0]; // 配列の1番目を取得
            var title = details.title;
            var filePath = details.file_path;
            var duration = details.duration;
            var qualities = [];
            for (var j = 0; j < videos[videoId].length; j++) {
                qualities.push(videos[videoId][j].quality);
            }

            //解像度をソート
            var isHighQualityMode = (document.getElementById('quality-priority').value === 'high');
            qualities.sort(function (a, b) {
                var numA = getQualityNumber(a);
                var numB = getQualityNumber(b);

                if (isHighQualityMode) {
                    return numB - numA; //降順(高画質が先:1080>720)
                } else {
                    return numA - numB; //昇順(低画質が先:360>720)
                }
            });

            //保存データの表示

            var container = document.createElement('div');
            container.className = 'video-item';

            var ThumbnailElement = document.createElement('img');
            ThumbnailElement.src = '/youtube/server/thumbnail/' + videoId;
            //もしサムネイルがないなら再度取得
            ThumbnailElement.onerror = function () {
                var retryCount = (retryCount || 0) + 1; //未定義なら0になる➡+1で"１回目"の意味になる
                var maxRetry = 3;
                console.log("サムネイルがありません。再ダウンロードします。" + this.retryCount + "回目...")
                if (this.retryCount <= maxRetry) {
                    var url = '/youtube/server/thumbnail/redownload'
                    var self = this; //thisはthumbnailElementを指す
                    xhrPostJSON(url, { videoId: videoId }, function (error, data) {
                        if (error) {
                            console.error("エラー：" + error);
                        } else {
                            //クエリパラメータをつけることで、新しい画像であることをブラウザに認識させる
                            self.src = '/youtube/server/thumbnail/' + videoId + "?retry=" + self.retryCount;
                        }
                    })
                } else {
                    console.error("最大リトライ回数を超えました。ID:" + videoId)
                    this.onerror = null; //エラーイベントの登録解除
                }

            }
            ThumbnailElement.alt = title;
            ThumbnailElement.className = 'thumbnail';
            container.appendChild(ThumbnailElement);
            var titleElement = document.createElement('p');
            titleElement.textContent = title;
            titleElement.id = 'video-title';
            container.appendChild(titleElement);
            var durationElement = document.createElement('p');
            durationElement.textContent = formatDuration(duration);
            durationElement.id = 'video-duration';
            container.appendChild(durationElement);
            var qualityselectElement = document.createElement('select');
            qualityselectElement.classList.add('video-quality');
            container.appendChild(qualityselectElement);
            for (var k = 0; k < qualities.length; k++) {
                var option = document.createElement('option');
                option.value = qualities[k];
                option.textContent = qualities[k];
                qualityselectElement.appendChild(option);
            }
            resultsContainer.appendChild(container);
            //クリックで再生するイベントリスナーを登録
            container.addEventListener('click', function () {
                if (isDeletable) { //削除モードがオン
                    deleteVideo(videoId, container, isVideo);
                } else { //削除モードがオフ
                    var currentQuality = qualityselectElement.value;
                    play(videoId, title, currentQuality, details);

                }
            });
            qualityselectElement.addEventListener('click', function (event) {
                event.stopPropagation(); //クリックイベントが親要素に伝播するのを防ぐ
            });
        })(videoId); //videoIdを引数として即時関数を呼び出す

    }
}

function formatDuration(sec) {
    var min = Math.floor(sec / 60);
    var s = sec % 60;
    s = s < 10 ? '0' + s : s;
    return min + ":" + s;
}

function play(VideoId, title, quality, data) {
    var playersection = document.getElementById('playerSection');
    var target = null;
    playersection.classList.remove('hidden');
    //動画情報を表示
    document.getElementById('videoTitle').textContent = title;


    //動画読み込み
    var videoPlayer = document.getElementById('videoPlayer');
    var audioPlayer = document.getElementById('audioPlayer');
    if (quality !== '128kbps' && quality !== '48kbps') { //動画の場合
        audioPlayer.classList.add('hidden');
        videoPlayer.classList.remove('hidden');
        audioPlayer.pause();
        audioPlayer.src = '';
        videoPlayer.src = 'youtube/server/stream/' + VideoId + '?quality=' + quality;
        target = videoPlayer;
    } else { //音声のみの場合
        videoPlayer.classList.add('hidden');
        audioPlayer.classList.remove('hidden');
        videoPlayer.pause();
        videoPlayer.src = '';
        audioPlayer.src = 'youtube/server/stream/' + VideoId + '?quality=' + quality;
        target = audioPlayer;
    }

    currentVideoId = video_list.indexOf(VideoId); //現在再生している動画のIDを保存
    target.onended = function () {
        playNext(allData);
    };
    function onCanPlay() {
        target.removeEventListener('canplay', onCanPlay);
        try {
            target.play();
            updateMediaSession(data); //メディアセッションの更新
        } catch (e) {
            console.error('再生エラー:', e);
        }

    }
    target.oncanplay = null;
    target.addEventListener('canplay', onCanPlay);
    target.onerror = function (e) { console.error('再生エラー:', e) };

}

function playNext(allData) {
    if (video_list.length === 0) return; //動画がない場合は何もしない
    currentVideoId++;
    if (currentVideoId >= video_list.length) currentVideoId = 0;
    var nextVideoId = video_list[currentVideoId];
    var mediaType = isVideo ? allData.videos : allData.audios;
    var nextDetails = mediaType[nextVideoId][0];
    var title = nextDetails.title;
    var qualitySelects = document.querySelectorAll('.video-quality');
    // 解像度を表示しているvideo-qualityクラス(selectタグ)の値を使う。もし取得できないなら
    // 最初に取得している動画全体のデータの中から再生しているvideoIdの次のvideoIdのqualityを取得する
    // それも取得できないなら128kbpsにする
    var quality = (qualitySelects[currentVideoId] && qualitySelects[currentVideoId].value) || nextDetails.quality || '128kbps';

    play(nextVideoId, title, quality, nextDetails);
}

function getQualityNumber(str) {
    return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

function updateMediaSession(data) {
    // 判定：機能がないブラウザではこの中身は完全に無視される

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: data.title,
            artwork: [{
                src: data.thumbnail_path, //サムネイルのURLを指定
                sizes: '512x512', // Xは小文字が一般的
                type: 'image/jpeg'
            }]
        });

        var videoPlayer = document.getElementById('videoPlayer');
        var audioPlayer = document.getElementById('audioPlayer');

        navigator.mediaSession.setActionHandler('play', function () {
            if (!audioPlayer.classList.contains('hidden')) {
                audioPlayer.play();
            } else {
                videoPlayer.play();
            }
            navigator.mediaSession.playbackState = 'playing';
        });

        // pauseアクション
        navigator.mediaSession.setActionHandler('pause', function () {
            if (!audioPlayer.classList.contains('hidden')) {
                audioPlayer.pause();
            } else {
                videoPlayer.pause();
            }
            navigator.mediaSession.playbackState = 'paused';
        });

        navigator.mediaSession.setActionHandler('nexttrack', function () {
            if (currentVideoId < 0 || !allData) return;

            // 次の動画・音声を再生
            playNext(allData); // すでに作った循環リスト関数
        });

        navigator.mediaSession.playbackState = 'playing';
    }
}

//動画・音声を削除する関数群

function deleteVideo(videoId, element, isVideo) {
    if (!window.confirm("この項目を削除しますか？")) return;

    var url = "/youtube/server/delete";
    var body = { videoId: videoId, isVideo: isVideo };
    xhrPostJSON(url, body, function (error, data) {
        if (error) {
            window.alert("削除に失敗しました");
            console.error(error);
        } else {
            element.style.display = 'none';

            var index = video_list.indexOf(videoId);
            if (index > -1) {
                video_list.splice(index, 1);
            }

            if (isVideo) {
                if (allData.videos && allData.videos[videoId]) {
                    delete allData.videos[videoId];
                }
            } else {
                if (allData.audios && allData.audios[videoId]) {
                    delete allData.audios[videoId];
                }
            }
            if (isVideo) {
                video_count--;
            } else {
                audio_count--;
            }
            get_count();

            isDeletable = false;
            console.log(videoId + "を削除しました");
        }
    })

}

/*TIPS*/

/*〇Object.entries(data.videos)
ES8(2017)で追加された
引数のオブジェクトが持つすべてのプロパティのキーと値のペアを配列として返す
ES5での代替手段 => キーの配列を作り、ループでアクセスする
var videos = data.videos;
var keys = Object.keys(videos); // キー（ID）の配列を作る

for (var i = 0; i < keys.length; i++) {
    var videoId = keys[i];
    var details = videos[videoId][0]; // 配列の1番目を取得

    console.log("動画ID:", videoId);
    console.log("タイトル:", details.title);
    ・・・
    
}
for (var videoId in videos) {
    if (videos.hasOwnProperty(videoId)) {
        var videoList = videos[videoId];
        var qualities = [];

        for (var i = 0; i < videoList.length; i++) {
            qualities.push(videoList[i].quality);
        }

        console.log("ID: " + videoId + " の解像度リスト:", qualities);
    }
}


〇即時関数(IIFE)
varは関数スコープを持つ。関数スコープは{}を無視して関数全体もしくはグローバルスコープになる
for(var i=0; i<3; i++){
}
console.log(i); //3と表示される
特にイベントリスナーなどでループ変数を参照する場合、ループが終了した後の値が参照されてしまう
displayVideos関数内のイベントリスナーでは...
1.var videoIdに新しいIDが上書きされる
2.クリックイベントを設定するが、イベントの中身は"今すぐ"ではなく、クリックされたときに実行される
3.ループ終了後にvideoIdは最後のIDになっている
➡どの動画をクリックしても最後のIDの動画が再生されてしまう

解決策は2つ
1.letを使う(ES6(2015)で追加された)
letはブロックスコープを持つので、ループごとに新しいスコープが作られ、変数iやvideoIdはループごとに独立して存在する
2.即時関数(IIFE)を使うこと(ES5以前の方法)
var f = function() {};
f();
➡(function() {
    //コード
})();
(function(){})で関数を定義し、最後の()でその関数を即座に呼び出す
(function(){})は関数オブジェクト(式)、後ろの()はそれを実行する呼び出し演算子


〇stopPropagation()
イベントが親要素に伝播するのを防ぐ
container(クリックのイベントリスナー登録)
  ┗select
この時、selectをクリックしたイベントがcontainerに伝わり、解像度を変更する前に動画が再生されてしまう
container(クリックのイベントリスナー登録)
  ┗select(クリックでstopPropagation()を呼び出すイベントリスナーを登録)
selectにstopPropagation()を呼び出すイベントリスナーを登録することで、selectをクリックしたときのイベントがcontainerに伝わるのを防ぎ、
解像度を変更してから動画が再生できるようになる

〇文字列から数値を取り出す
parseInt(str.replace(/[^0-9]/g,''),10) || 0;
・str.replace(/[^0-9]/g, '')
 /[^0-9]/g : 0~9以外の文字を文字列全体(g)から探す
 '' : 見つかった文字を空文字に入れ替える
 ➡"1080円"が"1080"になる
・parseInt(... , 10)
 文字列を10進数の整数に変換する
 ➡"1080"(String)が1080(int)になる
・|| 0
 デフォルト値の設定(エラーガード)
 元の文字列に数字が無ければreplaceで空文字になる
 空文字をparseIntすると結果はNaN(Not a Number:数値ではない)になる
 NaN || 0 => 0 となるので、数字が無い場合でも数値が出てくるため、呼び出し側でのエラーを防止できる
replaceはStringオブジェクトがもつメソッドなので、replaceメソッドを持たないUndefinedオブジェクトを対象にするとエラーになる
parseInt()は関数なので、Undefinedを引数にしてもエラーにならない(NaNになる)

〇splice:配列のメソッド
配列.splice(開始位置, 削除する個数)
[A, B, C, D, E]からBを削除する
splice(1,1)
➡[A, C, D, E]となり、空きは詰められる
spliceの本来の意味は"分かれているもの(あるいは分けたもの)を再構成して１つにする"という意味
ロープやワイヤーのように端と端を編み合わせたり、フィルムのように重ねて結合することを意味する
ひとたび結合すると元の状態には戻らないので、spliceは破壊的操作といえる
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