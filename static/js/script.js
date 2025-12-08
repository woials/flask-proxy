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
    const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
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

    //プレイヤーを表示
    const playersection = document.getElementById('playerSection');
    playersection.classList.remove('hidden');

    //動画情報を表示
    document.getElementById('videoTitle').textContent = title;
    document.getElementById('videoUploader').textContent = uploader || "";
    document.getElementById('videoDescription').textContent = description || "";

    //動画読み込み
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.src = `/stream/${VideoId}`;
    try {
        await videoPlayer.play();
        //動画開始したらMedia Session APIを更新
        updateMediaSession(title, uploader, thumbnailURL);
    } catch (error) {
        console.log("動画の自動再生に失敗 ", error);
        alert("動画の再生を開始できませんでした。画面をタップして再生してください。");
    }
    loadRelatedVideos(VideoId);
}


async function loadRelatedVideos(videoId) {
    document.getElementById('slidebarTitle').textContent = '関連動画';

    const response = await fetch(`/related/${videoId}`);
    const videos = await response.json();

    // 現在の動画を除外
    const filtered = videos.filter(v => v.id !== videoId);
    displayVideos(filtered);
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