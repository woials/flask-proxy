let currentVideo=null;

async function search() {
    const query=document.getElementById('searchBox').value;
    if(!query)return;
    /*URI:Uniform Resource Identifier
    リソースを一意に識別するためのデータ形式 URLやスキーム名(https)
    encodeURIComponent()はURI内で扱えない文字(非ASCII文字、スペース、/?&=#:@など)をエスケープする
    %と16進数でエスケープシーケンスとして表現する
    主にクエリパラメータ(URLの?以降の部分)の値をエンコードするときに使う*/

    const response=await fetch('/search?q=${encodeURIComponent(query)}');
    const videos=await response.json;
    console.log(videos);
    document.getElementById('slidebarTitle').textContent="検索結果";
    displayVideos(videos);
}
function displayVideos(videos) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = videos.map(v => `
        <div class="video-item" onclick='playVideo("${v.id}", ${JSON.stringify(v.title)}, ${JSON.stringify(v.description || '')}, ${JSON.stringify(v.uploader || '')})'>
            <img src="${v.thumbnail}" alt="${v.title}">
            <div class="video-details">
                <h3>${v.title}</h3>
                <small>${v.uploader || '不明'}</small><br>
                <small>${formatViews(v.view_count)}回視聴</small>
            </div>
        </div>
    `).join('');
}
async function playVideo(VideoId,title,description,uploader) {
    currentVideo={id:VideoId,title,description,uploader};

    //プレイヤーを表示
    const playersection=document.getElementById('playerSection');
    playersection.classList.remove('hidden');

    //動画情報を表示
    document.getElementById('videoTitle').textContent=title;
    document.getElementById('videoUploader').textContent=uploader || "";
    document.getElementById('videoDescription').textContent=description || "";

    const videoPlayer=document.getElementById('videoPlayer');
    videoPlayer.src='/stream/${videoId}';
    videoPlayer.play();
}currentVideo = null;

async function search() {
    const query = document.getElementById('searchBox').value;
    if (!query) return;
    
    const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
    const videos = await response.json();
    
    document.getElementById('slidebarTitle').textContent = '検索結果';
    displayVideos(videos);
}

async function playVideo(videoId, title, description, uploader) {
    currentVideo = { id: videoId, title, description, uploader };
    
    // プレイヤーを表示
    const playerSection = document.getElementById('playerSection');
    playerSection.classList.remove('hidden');
    
    // 動画情報を表示
    document.getElementById('videoTitle').textContent = title;
    document.getElementById('videoUploader').textContent = uploader || '';
    document.getElementById('videoDescription').textContent = description || '説明なし';
    
    // 動画を読み込み
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.src = `/stream/${videoId}`;
    videoPlayer.play();
    
    // 関連動画を読み込み
    loadRelatedVideos(videoId);
}

async function loadRelatedVideos(videoId) {
    document.getElementById('sidebarTitle').textContent = '関連動画';
    
    const response = await fetch(`/related/${videoId}`);
    const videos = await response.json();
    
    // 現在の動画を除外
    const filtered = videos.filter(v => v.id !== videoId);
    displayVideos(filtered);
}

function displayVideos(videos) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = videos.map(v => `
        <div class="video-item" onclick='playVideo("${v.id}", ${JSON.stringify(v.title)}, ${JSON.stringify(v.description || '')}, ${JSON.stringify(v.uploader || '')})'>
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