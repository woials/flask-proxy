/*Service Workerでキャッシュを保持するためにworkboxをCDN経由でダウンロード*/ 
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');


self.addEventListener('fetch', function(event) {
    event.respondWith(
        fetch(event.request).catch(function() {
            return caches.match(event.request);
        })
    );
});

if (workbox) {
  // 動画配信URL（/youtube/stream/...）へのリクエストをキャッシュする
  workbox.routing.registerRoute(
    ({url}) => url.pathname.startsWith('/youtube/stream/'),
    new workbox.strategies.CacheFirst({
      cacheName: 'video-storage',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses:[0,200,206], //206(Partialもキャッシュ対象)
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
}

if(workbox){
  // スタートページへのリクエストをキャッシュする
}