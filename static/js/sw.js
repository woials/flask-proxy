importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

// Workboxが正しく読み込まれたか確認
if (workbox) {
  console.log('Workbox is loaded');

  // 新しいSWがインストールされたら、すぐに制御を開始する設定
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // 動画配信URL（/youtube/stream/...）へのリクエストをキャッシュする
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/youtube/stream/'),
    new workbox.strategies.CacheFirst({
      cacheName: 'video-storage',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200, 206], //206(Partialもキャッシュ対象)
        }),
        // 動画のような大きなファイルを扱うための必須プラグイン
        new workbox.rangeRequests.RangeRequestsPlugin(),
        // 10個まで、あるいは30日間保存するなどの制限（スマホの容量節約）
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    })
  );

  /*ホーム画面をキャッシュに登録 */
  workbox.routing.registerRoute(
    ({request,url}) =>
      request.mode==='navigate' &&
      url.pathname==='/',
    new workbox.strategies.NetworkFirst({
      cacheName:'Home-html'
    })
  )
  workbox.routing.registerRoute(
    ({url}) =>
      url.pathname==='/static/weather.png',
    new workbox.strategies.CacheFirst({
      cacheName:'weather-icon'
    })
  )
  workbox.routing.registerRoute(
    ({url}) =>
      url.pathname==='/static/youtube.png',
    new workbox.strategies.CacheFirst({
      cacheName:'youtube-icon'
    })
  )
  workbox.routing.registerRoute(
    ({url}) =>
      url.pathname==='/static/radio.png',
    new workbox.strategies.CacheFirst({
      cacheName:'radio-icon'
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

}