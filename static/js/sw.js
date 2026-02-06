importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');



// Workboxが正しく読み込まれたか確認
if (workbox) {
  console.log('Workbox is loaded');

  // 新しいSWがインストールされたら、すぐに制御を開始する設定
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // 動画配信URL（/video/<video_id>）へのリクエストをキャッシュする
  workbox.routing.registerRoute(
  ({ url }) => url.pathname.includes('/youtube/video/') && url.searchParams.has('cache'),
  new workbox.strategies.CacheFirst({
    cacheName: 'video-storage',
    fetchOptions: {
      // 重要：Rangeヘッダーを無視してフルデータを取得しにいく
      headers: { 'Range': 'bytes=0-' } 
    },
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [200], // 保存するのは 200 (Full) のみ
      }),
      new workbox.rangeRequests.RangeRequestsPlugin(), // キャッシュから 206 として切り出す
      new workbox.expiration.ExpirationPlugin({
        maxAgeSeconds:30*24*60*60 //30日
      })
    ],
  })
);

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

}