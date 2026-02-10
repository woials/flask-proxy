importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

const isIOS =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);


// Workboxが正しく読み込まれたか確認
if (workbox) {
  console.log('Workbox is loaded');

  // 新しいSWがインストールされたら、すぐに制御を開始する設定
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // 動画配信URL（/video/<video_id>）へのリクエストをキャッシュする
  workbox.routing.registerRoute(
    ({ url }) =>
      url.pathname.includes('/youtube/video/') &&
      url.searchParams.has('cache'),

    new workbox.strategies.CacheFirst({
      cacheName: 'video-storage',
      fetchOptions: {
        headers: { 'Range': 'bytes=0-' }
      },
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [200],
        }),
        new workbox.rangeRequests.RangeRequestsPlugin(),
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 30 * 24 * 60 * 60
        }),

        {
          //indexedDBに動画メタデータを保存する
          async handlerDidComplete({ request, response }) {
            if (!response || response.status !== 200) return; //responseがない or 200(ok)ではない➡return

            const url = new URL(request.url);
            const videoId = url.pathname.split('/').pop();
            // /youtube/video/abc123 を　["", "youtube", "video", "abc123"]　に分割し、配列の１番後ろの要素を取得(pop)

            // self=Service Worker
            // self.clients.matchAllは"Service Workerに紐づいているmatchAllの条件に合う
            // クライアント(制御下にあるタブやウィンドウ)をすべて列挙する" 
            const clientsList = await self.clients.matchAll({
              type: 'window',
              includeUncontrolled: true
            });

            for (const client of clientsList) {
              client.postMessage({
                type: 'CACHED',
                videoId
              });
            }
          }
        }
      ],
    })
  );

  //動画サムネイルをキャッシュに保存
  if (!isIOS) {
    workbox.routing.registerRoute(
      ({ url,request }) =>
        url.hostname === 'i.ytimg.com' &&
        url.pathname.startsWith('/vi/') &&
        url.pathname.endsWith('/hqdefault.jpg') &&
        url.searchParams.has('Store_thumbnail') ,
        
      new workbox.strategies.CacheFirst({
        cacheName: 'thumbnail-storage',
        plugins: [
          new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200],
            // サムネイルは外部サイトから取得する。youtubeはAccess-Control-Allow-Originを付けていないので、JavaScriptからは中身が一切見れない
            // 中身が一切見れない(=opaque)場合、responseが0になるのでそれを保存。
            // JavaScriptから見れないだけであって、ブラウザからは中身が見れるので画像の表示には問題ない
          }),
          new workbox.expiration.ExpirationPlugin({
            maxAgeSeconds: 30 * 24 * 60 * 60
          })
        ]
      })
    )
  }


  /*ホーム画面をキャッシュに登録 */
  workbox.routing.registerRoute(
    ({ request, url }) =>
      request.mode === 'navigate' &&
      url.pathname === '/',
    new workbox.strategies.NetworkFirst({
      cacheName: 'Home-html'
    })
  )
  workbox.routing.registerRoute(
    ({ url }) =>
      url.pathname === '/static/weather.png',
    new workbox.strategies.CacheFirst({
      cacheName: 'weather-icon'
    })
  )
  workbox.routing.registerRoute(
    ({ url }) =>
      url.pathname === '/static/youtube.png',
    new workbox.strategies.CacheFirst({
      cacheName: 'youtube-icon'
    })
  )
  workbox.routing.registerRoute(
    ({ url }) =>
      url.pathname === '/static/radio.png',
    new workbox.strategies.CacheFirst({
      cacheName: 'radio-icon'
    })
  )

  /*天気アプリをキャッシュに登録 */
  workbox.routing.registerRoute(
    ({ request, url }) =>
      request.mode === 'navigate' &&
      url.pathname.startsWith('/weather/web'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'weather-html',
    })
  );

  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/weather/api'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'weather-api',
    })
  );

  workbox.routing.registerRoute(
    ({ url }) => url.pathname === '/static/js/weather.js',
    new workbox.strategies.CacheFirst({
      cacheName: 'weather-js',
    })
  );

  workbox.routing.registerRoute(
    ({ url }) => url.pathname === '/static/css/weather.css',
    new workbox.strategies.CacheFirst({
      cacheName: 'weather-css',
    })
  );
  workbox.routing.registerRoute(
    ({ url }) => url.pathname === '/static/home.png',
    new workbox.strategies.CacheFirst({
      cacheName: 'Home-icon'
    })
  )
  // self.addEventListener('fetch',e =>{
  //   const url=new URL(e.request.url);
  //   if(url.pathname.includes('/youtube/video') && url.searchParams.has('cache')){
  //     const strategy=new workbox.strategies.CacheFirst({
  //       cacheName:'video-storage',
  //       fetchOptions:{
  //         headers:{'Range':'bytes=0-'}
  //       },
  //       plugins:[
  //         new workbox.cacheableResponse.CacheableResponsePlugin({
  //           statuses:[200],
  //         }),
  //         new workbox.rangeRequests.RangeRequestsPlugin(),
  //         new workbox.expiration.ExpirationPlugin({
  //           maxAgeSeconds:30*24*60*60
  //         }),
  //       ],
  //     });
  //     e.respondWith(strategy.handle({e}));
  //   }
  // });
}