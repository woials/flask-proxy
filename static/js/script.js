import { openDB } from 'https://unpkg.com/idb?module';
let currentVideo = null;
const videoMetadata = new Map();
let selected_cachevideo = document.getElementById('StoredVideo');
let audio_setting = document.getElementById('AudioOption');

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
                ytStore.createIndex("isVideo","isVideo",{unique:false});
                ytStore.createIndex("quality","quality",{unique:false});
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
        const videoPlayer = document.getElementById('videoPlayer');
        navigator.mediaSession.setActionHandler('play', () => {
            videoPlayer.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            videoPlayer.pause();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            //次の関連動画を再生するロジックを作る
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
    currentVideo = { id: VideoId, title, description, uploader, thumbnailURL };
    if (selected_cachevideo.checked) {
        const db=await open_db();
        const record=await db.get("youtube",VideoId);
        const quality=record.quality;
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
            "quality": quality
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
    const videoPlayer = document.getElementById('videoPlayer');
    const audioPlayer = document.getElementById('audioPlayer');
    if (quality !== '128' && quality !== '48') { //音声ではない
        audioPlayer.classList.add('hidden');
        videoPlayer.classList.remove('hidden');
        audioPlayer.pause();
        audioPlayer.src="";
        if (selected_cachevideo.checked) {//保存した動画を再生
            videoPlayer.src = `youtube/video/${VideoId}?cache=1`
        } else {
            videoPlayer.src = `youtube/video/${VideoId}`;
            if (isCache.checked) {//キャッシュする
                videoPlayer.src += '?cache=1';
                fetch(thumbnailURL + '?Store_thumbnail=1', { mode: 'no-cors' });
            }
        }
    }else{
        videoPlayer.classList.add('hidden');
        audioPlayer.classList.remove('hidden');
        videoPlayer.pause();
        videoPlayer.src="";
        if(selected_cachevideo.checked){
            audioPlayer.src=`youtube/video/${VideoId}?audio=1&cache=1`
        }else{
            audioPlayer.src=`youtube/video/${VideoId}?audio=1`;
            if(isCache.checked){
                audioPlayer.src+='&cache=1';
                fetch(thumbnailURL+'?Store_thumbnail=1',{mode:'no-cors'});
            }
        }
    }


    try {
        if (quality !== '128' && quality !== '48'){
            await videoPlayer.play();
        }else{
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

document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('videoPlayer');
    if ('mediaSession' in navigator && videoPlayer) {
        videoPlayer.addEventListener('play', () => {
            navigator.mediaSession.playbackState = 'playing';
        });
        videoPlayer.addEventListener('pause', () => {
            navigator.mediaSession.playbackState = 'paused';
        });
    }
});

export async function saveVideo(videoId, title, duration, uploader, thumbnailURL,isVideo,quality) {
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

// Service Workerから送信されたmessageを受信➡indexedDBに動画メタデータを保存
navigator.serviceWorker.addEventListener("message", e => {
    if (e.data?.type === "CACHED") {
        const videoId=e.data.videoId;
        const meta = videoMetadata.get(e.data.videoId);
        if (!meta) return;
        const quality=document.getElementById('qualitySelect').value;
        const isVideo=!(quality==='128' || quality==='48');
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

// キャッシュした動画を一覧表示
selected_cachevideo.addEventListener('change', async () => {
    if (selected_cachevideo.checked) {
        const data = await getIndexedDB();
        displayVideos(data);
    } else {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '';
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
            `<option value="${d.val}">${d.text}</option>"`
        ).join('');
    } else {
        title.textContent = "画質設定";
        options.innerHTML = video_settings.map(d =>
            `<option value="${d.val}">${d.text}</option>"`
        ).join('');
    }
})
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
    return new Promise(r => requestAnimationFrame(r));

}
async function deleteloading() {
    const video_info = document.getElementById('video-info');
    const video_info_css = document.querySelector('.loading-bar');
    video_info.classList.remove('show')
    video_info.classList.add('hide');
    video_info.textContent = "";
    video_info_css.style.backgroundColor = "rgb(0,255,255,0.5)";
    return new Promise(r => requestAnimationFrame(r));
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

window.app = {
    search,
    fetchVideo
};