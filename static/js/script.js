import {openDB} from 'https://unpkg.com/idb?module';
let currentVideo = null;
const videoMetadata=new Map();
export async function open_db() {
    let db; 
    db=await openDB("youtube-DB",2,{
        upgrade(db){
            if(!db.objectStoreNames.contains("youtube")){
                const ytStore=db.createObjectStore("youtube",{keyPath:'videoId',}); 
                ytStore.createIndex("title","title",{unique:false});
                ytStore.createIndex("duration","duration",{unique:false});
                ytStore.createIndex("cached","cached",{unique:false}); 
                ytStore.createIndex("lastPlayed","lastPlayed",{unique:false});
                ytStore.createIndex("uploader","uploader",{unique:false});
                ytStore.createIndex("thumbnailURL","thumbnailURL",{unique:false});
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

    // "/search+クエリ"の結果を取得する➡pythonのsearch()を実行し、yt-dlpの結果を取得する
    const response = await fetch(`youtube/search?q=${encodeURIComponent(query)}`);
    const videos = await response.json();
    document.getElementById('slidebarTitle').textContent = "検索結果";
    displayVideos(videos);
}

export async function fetchVideo(VideoId, title, description, uploader, thumbnailURL,duration) {
    currentVideo = { id: VideoId, title, description, uploader, thumbnailURL };
    const quality = document.getElementById('qualitySelect').value;
    const url = `/youtube/stream/${VideoId}`;
    const start = Date.now();
    const TIMEOUT = 60_000; //60s ＿をつけると桁を区切れる
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

    while (true) {
        if (Date.now() - start > TIMEOUT) return;
        try {
            const res = await fetch(`/youtube/status/${VideoId}`);
            const json = await res.json();
            if (json.ready) {
                play(VideoId, quality, title, uploader, thumbnailURL, description,duration);
                return;
            }
        } catch { }

        await new Promise(r => setTimeout(r, 1000));
    }

}
export async function play(VideoId, quality, title, uploader, thumbnailURL, description,duration) {
    const isCache=document.getElementById('CacheOption');
    //プレイヤーを表示
    const playersection = document.getElementById('playerSection');
    playersection.classList.remove('hidden');

    //動画のメタデータをMapに保存
    videoMetadata.set(VideoId,{
        title:title,
        duration:duration,
        uploader:uploader,
        thumbnailURL:thumbnailURL
    })

    //動画情報を表示
    document.getElementById('videoTitle').textContent = title;
    document.getElementById('videoUploader').textContent = uploader || "";
    document.getElementById('videoDescription').textContent = description || "";

    //動画読み込み
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.src = `youtube/video/${VideoId}`;
    if(isCache.checked){
        videoPlayer.src+='?cache=1';
        fetch(thumbnailURL+'?Store_thumbnail=1',{mode:'no-cors'});
    }
    try {
        await videoPlayer.play();
        updateMediaSession(title, uploader, thumbnailURL);
    } catch (error) {
        console.error("動画の再生に失敗しました:", error);
    }
    loadRelatedVideos(VideoId);
}

export async function loadRelatedVideos(videoId) {
    document.getElementById('slidebarTitle').textContent = '関連動画';

    const response = await fetch(`youtube/related/${videoId}`);
    const videos = await response.json();

    // 現在の動画を除外
    const filtered = videos.filter(v => v.id !== videoId);
    displayVideos(filtered);
}

export function displayVideos(videos) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = videos.map(v => {
        //シングルクォートをエスケープ
        // /'/gはすべてのシングルクオートを対象にするという意味
        // gはグローバルフラグ、すべての一致を対象にする
        const safeTitle = v.title.replace(/'/g, '\\');
        const duration=v.duration;
        const minutes=Math.floor(duration/60);
        const seconds=duration%60;
        return ` 
        <div class="video-item" onclick='app.fetchVideo(
        "${v.id}",
         ${JSON.stringify(safeTitle)},
          ${JSON.stringify(v.description || '')},
           ${JSON.stringify(v.uploader || '')},
           "${v.thumbnail}",
           "${v.duration}"
           )'>
            <img src="${v.thumbnail}" alt="${v.title}">
            <div class="video-details">
                <h3>${v.title}</h3>
                <small>${v.uploader || '不明'}</small><br>
                <small>${formatViews(v.view_count)}回視聴<br></small>
                <p class="duration">${minutes}:${seconds.toString().padStart(2,'0')}</p>
            </div>
        </div>
    `;
    }).join('');
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

export async function saveVideo(videoId,title,duration,uploader,thumbnailURL) {
    try{
        const db=await open_db();
        const tx=db.transaction(["youtube"],'readwrite');
        const youtube=tx.objectStore('youtube');
        await youtube.put({
            videoId,
            title,
            duration, //変数名とキーの名前が同じなら省略できる(ES6のオブジェクトプロパティ省略記法)
            cached:true,
            lastPlayed:Date.now(),
            uploader,
            thumbnailURL
        })
        await tx.done;
    }catch(error){
        console.log(`保存できませんでした。${error}`);
    }
    
}

navigator.serviceWorker.addEventListener("message",e =>{
    if(e.data?.type==="CACHED"){
        const meta=videoMetadata.get(e.data.videoId);
        if(!meta)return;
        saveVideo(
            e.data.videoId,
            meta.title,
            meta.duration,
            meta.uploader,
            meta.thumbnailURL
        );
    }
} )

window.app={
    search,
    fetchVideo
};