const CACHE_NAME = 'mondelicieux-20260520';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './help.html',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.matchAll({ includeUncontrolled: true }))
     .then(clients => clients.forEach(c => c.postMessage({ type: 'NEW_VERSION' })))
  );
  self.clients.claim();
});

// Network-first：最新を優先、失敗時はキャッシュから返す
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
