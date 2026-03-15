import { openDB } from 'https://unpkg.com/idb?module';
let current = null;
let currentIndex = 0;
const videoMetadata = new Map();
let selected_cachevideo;
let audio_setting;
let video_lists = []
let audio_lists = []
let videoPlayer;
let audioPlayer;
let isToggleOptions = false;

console.log("ES6 module loaded");
window.app = {
    search,
    fetchVideo
};
console.log(document.getElementById('qualitySelect').value);
console.log(document.getElementById('StoredVideo'));

export async function open_db() {
    let db;
    db = await openDB("youtube-DB", 4, {
        upgrade(db) {
            if (!db.objectStoreNames.contains("youtube")) {
                const ytStore = db.createObjectStore("youtube", { keyPath: 'videoId', });
                ytStore.createIndex("title", "title", { unique: false });
                ytStore.createIndex("duration", "duration", { unique: false });
                ytStore.createIndex("cached", "cached", { unique: false });
                ytStore.createIndex("lastPlayed", "lastPlayed", { unique: false });
                ytStore.createIndex("uploader", "uploader", { unique: false });
                ytStore.createIndex("thumbnailURL", "thumbnailURL", { unique: false });
                ytStore.createIndex("isVideo", "isVideo", { unique: false });
                ytStore.createIndex("quality", "quality", { unique: false });
            }
        }
    })
    return db;
}

export function updateMediaSession(title, uploader, thumbnailURL) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: uploader || "不明",
            artwork: [{
                src: thumbnailURL,
                sizes: '512X512',
                type: 'image/jpeg'
            }]
        });
        videoPlayer = document.getElementById('videoPlayer');
        audioPlayer = document.getElementById('audioPlayer');
        navigator.mediaSession.setActionHandler('play', () => {
            if (!audioPlayer.classList.contains('hidden')) {
                audioPlayer.play();
            } else {
                videoPlayer.play();
            }

        });
        navigator.mediaSession.setActionHandler('pause', () => {
            if (!audioPlayer.classList.contains('hidden')) {
                audioPlayer.pause();
            } else {
                videoPlayer.pause();
            }
        });
        navigator.mediaSession.setActionHandler('nexttrack', async () => {
            if (!audioPlayer.classList.contains('hidden')) { //audioPlayerが表示されている＝音声再生モード
                let videoId = playNext();
                let title, uploader, thumbnailURL;
                if (videoId) {
                    audioPlayer.src = `youtube/video/${videoId}?audio=1&cache=1`
                    current = videoId;
                    currentIndex = audio_lists.findIndex(v => v.videoId === videoId);
                    title = audio_lists[currentIndex].title;
                    uploader = audio_lists[currentIndex].uploader;
                    thumbnailURL = audio_lists[currentIndex].thumbnailURL;
                    document.getElementById('videoTitle').textContent = title;
                    document.getElementById('videoUploader').textContent = uploader || "";
                    try {
                        audioPlayer.load();
                        await audioPlayer.play();
                        if ('mediaSession' in navigator) {

                            navigator.mediaSession.metadata = new MediaMetadata({
                                title: title,
                                artist: uploader || "不明",
                                artwork: [{
                                    src: thumbnailURL,
                                    sizes: '512X512',
                                    type: 'image/jpeg'
                                }]
                            });
                        }
                    } catch (error) {
                        console.error("音声の再生に失敗しました:", error);
                    }
                }
            } else { //videoPlayerが表示されている＝動画再生モード
                let videoId = playNext();
                let title, uploader, thumbnailURL;
                if (videoId) {
                    videoPlayer.src = `youtube/video/${videoId}?cache=1`
                    current = videoId;
                    currentIndex = video_lists.findIndex(v => v.videoId === videoId);
                    title = video_lists[currentIndex].title;
                    uploader = video_lists[currentIndex].uploader;
                    thumbnailURL = video_lists[currentIndex].thumbnailURL;
                    document.getElementById('videoTitle').textContent = title;
                    document.getElementById('videoUploader').textContent = uploader || "";
                    try {
                        videoPlayer.load();
                        await videoPlayer.play();
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.metadata = new MediaMetadata({
                                title: title,
                                artist: uploader || "不明",
                                artwork: [{
                                    src: thumbnailURL,
                                    sizes: '512X512',
                                    type: 'image/jpeg'
                                }]
                            });
                        }
                    } catch (error) {
                        console.error("動画の再生に失敗しました:", error);
                    }
                }
            }

        });
        navigator.mediaSession.playbackState = 'playing';
    }
}

export async function search() {
    const query = document.getElementById('searchBox').value;
    if (!query) return;
    /*URI:Uniform Resource Identifier
    リソースを一意に識別するためのデータ形式 URLやスキーム名(https)
    encodeURIComponent()はURI内で扱えない文字(非ASCII文字、スペース、/?&=#:@など)をエスケープする
    %と16進数でエスケープシーケンスとして表現する
    主にクエリパラメータ(URLの?以降の部分)の値をエンコードするときに使う*/

    const response = await fetch(`youtube/search?q=${encodeURIComponent(query)}`);
    const videos = await response.json();
    document.getElementById('slidebarTitle').textContent = "検索結果";
    displayVideos(videos);
}

export async function fetchVideo(VideoId, title, description, uploader, thumbnailURL, duration) {
    await showloading();
    const selected_cachevideo = document.getElementById('StoredVideo');
    const audio_setting = document.getElementById('AudioOption');
    if (selected_cachevideo.checked) {
        const db = await open_db();
        const record = await db.get("youtube", VideoId);
        const quality = record.quality;
        play(VideoId, quality, title, uploader, thumbnailURL, description, duration);
        return;
    }
    const quality = document.getElementById('qualitySelect').value;
    const url = `/youtube/stream/${VideoId}`;
    const startRes = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "quality": quality,
            "title":title
        })
    })
    if (!startRes.ok) return;
    if (!selected_cachevideo.checked) {
        while (true) {
            try {
                const res = await fetch(`/youtube/status/${VideoId}`);
                const json = await res.json();
                if (json.ready) {
                    play(VideoId, quality, title, uploader, thumbnailURL, description, duration);
                    return;
                }
            } catch { }

            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

export async function play(VideoId, quality, title, uploader, thumbnailURL, description, duration) {
    const isCache = document.getElementById('CacheOption');
    const selected_cachevideo = document.getElementById('StoredVideo');
    const audio_setting = document.getElementById('AudioOption');
    //プレイヤーを表示
    const playersection = document.getElementById('playerSection');
    playersection.classList.remove('hidden');

    //動画のメタデータをMapに保存
    videoMetadata.set(VideoId, {
        title: title,
        duration: duration,
        uploader: uploader,
        thumbnailURL: thumbnailURL
    })

    //動画情報を表示
    document.getElementById('videoTitle').textContent = title;
    document.getElementById('videoUploader').textContent = uploader || "";
    document.getElementById('videoDescription').textContent = description || "";

    //動画読み込み
    videoPlayer = document.getElementById('videoPlayer');
    audioPlayer = document.getElementById('audioPlayer');
    if (quality !== '128' && quality !== '48') { //音声ではない
        audioPlayer.classList.add('hidden');
        videoPlayer.classList.remove('hidden');
        audioPlayer.pause();
        audioPlayer.src = "";
        if (selected_cachevideo.checked) {//保存した動画を再生
            videoPlayer.src = `youtube/video/${VideoId}?cache=1`
            current = VideoId;
            currentIndex = video_lists.findIndex(v => v.videoId === VideoId);
        } else {
            videoPlayer.src = `youtube/video/${VideoId}`;
            if (isCache.checked) {//キャッシュする
                videoPlayer.src += '?cache=1';
                fetch(thumbnailURL + '?Store_thumbnail=1', { mode: 'no-cors' });
            }
        }
    } else {
        videoPlayer.classList.add('hidden');
        audioPlayer.classList.remove('hidden');
        videoPlayer.pause();
        videoPlayer.src = "";
        if (selected_cachevideo.checked) {
            audioPlayer.src = `youtube/video/${VideoId}?audio=1&cache=1`
            current = VideoId;
            currentIndex = audio_lists.findIndex(v => v.videoId === VideoId);
        } else {
            audioPlayer.src = `youtube/video/${VideoId}?audio=1`;
            if (isCache.checked) {
                audioPlayer.src += '&cache=1';
                fetch(thumbnailURL + '?Store_thumbnail=1', { mode: 'no-cors' });
            }
        }
    }


    try {
        if (quality !== '128' && quality !== '48') {
            await videoPlayer.play();
        } else {
            await audioPlayer.play();
        }

        updateMediaSession(title, uploader, thumbnailURL);
    } catch (error) {
        console.error("動画の再生に失敗しました:", error);
    }
    if (!selected_cachevideo.checked) {
        loadRelatedVideos(VideoId);
    }
    await deleteloading();

}

// 関連動画を検索
export async function loadRelatedVideos(videoId) {
    document.getElementById('slidebarTitle').textContent = '関連動画';

    const response = await fetch(`youtube/related/${videoId}`);
    const videos = await response.json();

    // 現在の動画を除外
    const filtered = videos.filter(v => v.id !== videoId);
    displayVideos(filtered);
}

function formatDuration(sec) {
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s.toString().padStart(2, '0')}`
}

function createVideoItem(v) {
    const item = document.createElement('div');
    item.className = 'video-item';

    item.addEventListener('click', () => {
        app.fetchVideo(
            v.videoId,
            v.title,
            v.description || '',
            v.uploader || '',
            v.thumbnailURL,
            v.duration
            );
    });

    item.innerHTML = `
    <img src="${v.thumbnailURL}" alt="${v.title}">
    <div class="video-details">
        <h3>${v.title}</h3>
        <small>${v.uploader || '不明'}</small>
        <small>${formatViews(v.view_count)}回視聴<br></small>
        <p class="duration">${formatDuration(v.duration)}</p>
    </div>
    `;
    return item;
}

export function displayVideos(videos) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    videos.forEach(v => {
        resultsDiv.appendChild(createVideoItem(v));
    })
}

export function formatViews(count) {
    if (!count) return '0';
    return count.toLocaleString();
}


export async function saveVideo(videoId, title, duration, uploader, thumbnailURL, isVideo, quality) {
    try {
        const db = await open_db();
        const tx = db.transaction("youtube", 'readwrite');
        const youtube = tx.objectStore('youtube');
        await youtube.put({
            videoId,
            title,
            duration, //変数名とキーの名前が同じなら省略できる(ES6のオブジェクトプロパティ省略記法)
            cached: true,
            lastPlayed: Date.now(),
            uploader,
            thumbnailURL,
            isVideo,
            quality
        })
        await tx.done;
        console.log("保存しました");
    } catch (error) {
        console.log(`保存できませんでした。${error}`);
    }

}
export async function getIndexedDB() {
    const db = await open_db();
    const tx = db.transaction("youtube", 'readonly');
    const store = tx.objectStore("youtube");
    const Alldata = await store.getAll();
    await tx.done;
    return Alldata;
}



async function showSetting() {
    const setting = document.querySelector('.options');
    setting.classList.remove('hidden');
    setting.classList.add('show');
    return new Promise(r => requestAnimationFrame(r));


}
async function hideSetting() {
    const setting = document.querySelector('.options');
    setting.classList.remove('show');
    setting.classList.add('hidden');

}

/*〇 map
    mapは”配列のすべての要素にアクセスして処理をし、あたらしい配列を作るメソッド
    audio_settingsの配列にアクセスし、<option value=・・・>という文字列を生成する
    そのままだと配列のままなので、joinでカンマを除いた１つの文字列に変換する
    その文字列をinnerHTMLで<select>に流し込む”*/
async function showloading() {
    const video_info = document.getElementById('video-info');
    const video_info_css = document.querySelector('.loading-bar');
    video_info.classList.remove("hide");
    video_info.classList.add('show');
    video_info_css.style.backgroundColor = "rgb(0,255,255,0.5)";
    video_info.textContent = "準備中...";
    // requestAnimationFrame:ブラウザの描画更新に合わせてこの関数を実行する
    // dxlibのScreenFlip()に近いもの
    //return new Promise(r => requestAnimationFrame(r));

}
async function deleteloading() {
    const video_info = document.getElementById('video-info');
    const video_info_css = document.querySelector('.loading-bar');
    video_info.classList.remove('show')
    video_info.classList.add('hide');
    video_info.textContent = "";
    video_info_css.style.backgroundColor = "rgb(0,255,255,0.5)";
    //return new Promise(r => requestAnimationFrame(r));
}
async function noticestored() {
    const video_info = document.getElementById('video-info');
    const video_info_css = document.querySelector('.loading-bar');
    video_info.classList.remove("hide");
    video_info.classList.add('show')
    video_info_css.style.backgroundColor = "rgb(0,255,0,0.5)";
    video_info.textContent = "保存しました";
    setTimeout(() => { //3秒が経過したらクラスを変更
        video_info.classList.remove('show');
        video_info.classList.add('hide');
    }, 3000);
    return new Promise(r => requestAnimationFrame(r));
}
function playNext() { //videoIDを返す関数
    if (audio_setting.checked) {
        if (currentIndex === -1 || audio_lists.length === 0) return;
        currentIndex = (currentIndex + 1) % audio_lists.length;
        current = audio_lists[currentIndex].videoId;
        return current;
    } else {
        if (currentIndex === -1 || video_lists.length === 0) return;
        currentIndex = (currentIndex + 1) % video_lists.length;
        current = video_lists[currentIndex].videoId;
        return current;
    }
}

async function deleteIndexedDB() {
    const db = await open_db();
    const tx = db.transaction("youtube", 'readwrite');
    const store = tx.objectStore("youtube");
    await store.clear();
    await tx.done;
    console.log("削除しました");
}
async function deleteCache() {
    const cacheNames = await caches.keys();
    const deletion = cacheNames.map(name => caches.delete(name));
    await Promise.all(deletion);
}

    // Service Workerから送信されたmessageを受信➡indexedDBに動画メタデータを保存
    if('serviceWorker' in navigator){
        navigator.serviceWorker.addEventListener("message", e => {
            if (e.data?.type === "CACHED") {
                const videoId = e.data.videoId;
                const meta = videoMetadata.get(e.data.videoId);
                if (!meta) return;
                const quality = document.getElementById('qualitySelect').value;
                let isVideo;
                if (quality === '128' || quality === '48') {
                    isVideo = "false";
                } else {
                    isVideo = "true";
                }
                saveVideo(
                    e.data.videoId,
                    meta.title,
                    meta.duration,
                    meta.uploader,
                    meta.thumbnailURL,
                    isVideo,
                    quality

                    );
                noticestored();
            }
        })

    }

    document.querySelector('.toggleoption').addEventListener('click', () => {
        const options = document.querySelector('.options');
        options.classList.toggle('show');
    });


videoPlayer = document.getElementById('videoPlayer');
audioPlayer = document.getElementById('audioPlayer');
selected_cachevideo = document.getElementById('StoredVideo');
audio_setting = document.getElementById('AudioOption');
document.getElementById('droptable').addEventListener('click', async () => {
    if (window.confirm("キャッシュに保存した動画をすべて削除します。よろしいですか？")) {
        await deleteIndexedDB();
        await deleteCache();
        const results = document.getElementById('results');
        results.innerHTML = "";
    }
});



    // キャッシュした動画を一覧表示
selected_cachevideo.addEventListener('change', async () => {
    if (selected_cachevideo.checked) {
        const data = await getIndexedDB();
        if (audio_setting.checked) {
            const filtered = data.filter(d => d.isVideo === "false");
            displayVideos(filtered);
            audio_lists = filtered;
        } else {
            const filtered = data.filter(d => d.isVideo === "true");
            displayVideos(filtered);
            video_lists = filtered;
        }
    }
});

audio_setting.addEventListener('change', () => {
    const title = document.getElementById('quality_title');
    const options = document.getElementById('qualitySelect');
    const audio_settings = [
        { val: '128', text: '128kbps' },
        { val: '48', text: '48kbps' }
    ]
    const video_settings = [
        { val: '144', text: '144p' },
        { val: '240', text: '240p' },
        { val: '360', text: '360p' },
        { val: '480', text: '480p' },
        { val: '720', text: '720p' },
        { val: '1080', text: '1080p' },
    ]
    if (audio_setting.checked) {
        title.textContent = "音質設定";
        options.innerHTML = audio_settings.map(d =>
    `<option value="${d.val}">${d.text}</option>`
    ).join('');
    } else {
        title.textContent = "画質設定";
        options.innerHTML = video_settings.map(d =>
    `<option value="${d.val}">${d.text}</option>`
    ).join('');
    }
});

videoPlayer.addEventListener('ended', async () => {
    if (audio_setting.checked) return;
    const nextVideoId = await playNext();
    if (nextVideoId) {
        videoPlayer.src = `youtube/video/${nextVideoId}?cache=1`;
        current = nextVideoId;
        currentIndex = video_lists.findIndex(v => v.videoId === nextVideoId);
    }
    try {
        await videoPlayer.play();
        updateMediaSession(videoMetadata.get(current).title, videoMetadata.get(current).uploader, videoMetadata.get(current).thumbnailURL);
    } catch (error) {
        console.error("動画の再生に失敗しました:", error);
    }
});

audioPlayer.addEventListener('ended', async () => {
    if (!audio_setting.checked) return;
    const nextVideoId = await playNext();
    if (nextVideoId) {
        audioPlayer.src = `youtube/video/${nextVideoId}?audio=1&cache=1`;
        current = nextVideoId;
        currentIndex = audio_lists.findIndex(v => v.videoId === nextVideoId);
    }
    try {
        await audioPlayer.play();
        updateMediaSession(videoMetadata.get(current).title, videoMetadata.get(current).uploader, videoMetadata.get(current).thumbnailURL);
    } catch (error) {
        console.error("音声の再生に失敗しました:", error);
    }
});

if ('mediaSession' in navigator && videoPlayer) {
    videoPlayer.addEventListener('play', () => {
        navigator.mediaSession.playbackState = 'playing';
    });
    videoPlayer.addEventListener('pause', () => {
        navigator.mediaSession.playbackState = 'paused';
    });
}
if ('mediaSession' in navigator && audioPlayer) {
    audioPlayer.addEventListener('play', () => {
        navigator.mediaSession.playbackState = 'playing';
    });
    audioPlayer.addEventListener('pause', () => {
        navigator.mediaSession.playbackState = 'paused';
    });
}
console.log("ES6 end, app=", window.app);