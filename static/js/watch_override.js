// watch_override.js
(function () {
    const player = typeof videojs !== 'undefined' ? videojs.getPlayer('player') : null;
    if (!player) return;

    const originalOn = player.on.bind(player);

    player.on = function (...args) {
        // 2引数形式で 'ended' を直接指定している場合だけブロックする
        // (target, 'ended', fn) のような3引数の内部中継は素通りさせる
        if (args.length === 2 && args[0] === 'ended') {
            console.log('[watch_override] blocked ended handler registration:', args[1]);
            return;
        }
        return originalOn(...args);
    };

    let unlocked = false;
    ['touchend', 'click'].forEach(evt => {
        document.addEventListener(evt, () => {
            if (!unlocked) {
                player.play().then(() => { unlocked = true; }).catch(() => { });
            }
        }, { once: true });
    });

    originalOn('ended', async () => {
        const nextId = await getNextVideoIdInPlaylist();
        if (!nextId) return;

        const source = await getPlaybackSource(nextId);
        if (!source) return;

        player.src(source);
        if (unlocked) {
            player.play().catch(err => console.warn('Autoplay failed:', err));
        }

        const newUrl = `/watch?v=${nextId}&list=${new URLSearchParams(location.search).get('list')}`;
        window.history.replaceState(null, '', newUrl);
        // タイトルなどのUIを更新する
        updateVideoMetadata(nextId);
    });

    async function updateVideoMetadata(nextID) {
        let metadata = await fetch(`/api/v1/videos/${nextID}`);
        let json = await metadata.json();

        // link-iv-listen(音声モードへのリンク)はタイトルのh1内にしか存在しないので、
        // そこから親方向に遡ってh-boxを特定する
        const listenLink = document.getElementById("link-iv-listen");
        const titleDiv = listenLink ? listenLink.closest(".h-box") : null;

        if (titleDiv) {
            const title = titleDiv.querySelector("h1");
            if (title) {
                const textNode = [...title.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
                if (textNode) {
                    textNode.textContent = json.title;
                } else {
                    title.textContent = json.title;
                }
            }
        }

        const published = document.getElementById("published-date");
        if (published) {
            const publishedDate = new Date(json.published * 1000);
            published.textContent = "公開日 " + publishedDate.toLocaleDateString();
        }

        const description=document.getElementById("descriptionWrapper");
        description.textContent=json.description;

        
    }

    async function getNextVideoIdInPlaylist() {
        const plid = new URLSearchParams(location.search).get('list');
        const currentVideoId = new URLSearchParams(location.search).get('v');
        if (!plid || !currentVideoId) return null;

        const res = await fetch(`/api/v1/playlists/${plid}`);
        if (!res.ok) return null;
        const playlist = await res.json();

        const videos = playlist.videos;
        const currentIndex = videos.findIndex(v => v.videoId === currentVideoId);
        if (currentIndex === -1 || currentIndex + 1 >= videos.length) return null;
        return videos[currentIndex + 1].videoId;
    }

    async function getPlaybackSource(videoId) {
        const res = await fetch(`/api/v1/videos/${videoId}?local=true`);
        if (!res.ok) return null;
        const data = await res.json();
        console.log('[watch_override] formatStreams:', data.formatStreams);
        const fmt = data.formatStreams.find(f => f.itag === "18" || f.itag === 18);
        if (!fmt) return null;
        return { src: fmt.url, type: fmt.type || 'video/mp4; codecs="avc1.42001E, mp4a.40.2"' };
    }
})();