let currentVideo = null;

function updateMediaSession(title, uploader, thumbnailURL) {
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

async function search() {
    const query = document.getElementById('searchBox').value;
    if (!query) return;
    /*URI:Uniform Resource Identifier
    リソースを一意に識別するためのデータ形式 URLやスキーム名(https)
    encodeURIComponent()はURI内で扱えない文字(非ASCII文字、スペース、/?&=#:@など)をエスケープする
    %と16進数でエスケープシーケンスとして表現する
    主にクエリパラメータ(URLの?以降の部分)の値をエンコードするときに使う*/

    // "/search+クエリ"の結果を取得する➡pythonのsearch()を実行し、yt-dlpの結果を取得する
    const response = await fetch(`youtube/search?q=${encodeURIComponent(query)}`);
    const videos = await response.json();
    document.getElementById('slidebarTitle').textContent = "検索結果";
    displayVideos(videos);
}


function displayVideos(videos) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = videos.map(v => `
        <div class="video-item" onclick='playVideo(
        "${v.id}", 
        ${JSON.stringify(v.title)}, 
        ${JSON.stringify(v.description || '')}, 
        ${JSON.stringify(v.uploader || '')},
        "${v.thumbnail}"
        )'>
            <img src="${v.thumbnail}" alt="${v.title}">
            <div class="video-details">
                <h3>${v.title}</h3>
                <small>${v.uploader || '不明'}</small><br>
                <small>${formatViews(v.view_count)}回視聴</small>
            </div>
        </div>
    `).join('');
}



async function playVideo(VideoId, title, description, uploader, thumbnailURL) {
    currentVideo = { id: VideoId, title, description, uploader, thumbnailURL };
    const url = `/youtube/stream/${VideoId}`;
    const cache=await caches.open('video-storage');
    const cachedResponse=await cache.match(url);
    const quality=document.getElementById('qualitySelect').value;
    
    //キャッシュの確認
    if(!cachedResponse){
        console.log("未キャッシュのため、バックグランドで保存を開始します...")
        fetch(url).then(response => { //awaitせずfetchだけ投げることで非同期処理
            if(response.ok) cache.put(url,response);
        });
    }
    //プレイヤーを表示
    const playersection = document.getElementById('playerSection');
    playersection.classList.remove('hidden');

    //動画情報を表示
    document.getElementById('videoTitle').textContent = title;
    document.getElementById('videoUploader').textContent = uploader || "";
    document.getElementById('videoDescription').textContent = description || "";

    //動画読み込み
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.src=`youtube/stream/${VideoId}?quality=${quality}`;
    try{
        await videoPlayer.play();
        updateMediaSession(title, uploader, thumbnailURL);
    }catch(error){
        console.error("動画の再生に失敗しました:",error);
    }
    loadRelatedVideos(VideoId);
}


async function loadRelatedVideos(videoId) {
    document.getElementById('slidebarTitle').textContent = '関連動画';

    const response = await fetch(`youtube/related/${videoId}`);
    const videos = await response.json();

    // 現在の動画を除外
    const filtered = videos.filter(v => v.id !== videoId);
    displayVideos(filtered);
}

function displayVideos(videos) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = videos.map(v => {
        //シングルクォートをエスケープ
        // /'/gはすべてのシングルクオートを対象にするという意味
        // gはグローバルフラグ、すべての一致を対象にする
        const safeTitle=v.title.replace(/'/g,'\\'); 
        return ` 
        <div class="video-item" onclick='playVideo(
        "${v.id}",
         ${JSON.stringify(safeTitle)},
          ${JSON.stringify(v.description || '')},
           ${JSON.stringify(v.uploader || '')},
           "${v.thumbnail}"
           )'>
            <img src="${v.thumbnail}" alt="${v.title}">
            <div class="video-details">
                <h3>${v.title}</h3>
                <small>${v.uploader || '不明'}</small><br>
                <small>${formatViews(v.view_count)}回視聴</small>
            </div>
        </div>
    `;
}).join('');
}

function formatViews(count) {
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