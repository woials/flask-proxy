let currentVideo=null;

async function search() {
    const query=document.getElementById('searchBox').value;
    if(!query)return;
    const response=await fetch('/search?q=${encodeURIComponent(query)}');
    const videos=await response.json;
    
    document.getElementById('sidebarTitle').textContent="検索結果";
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