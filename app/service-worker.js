// App-shell caching only, for install/offline-launch support. Deliberately
// does not intercept Sheets API or Google auth requests (cross-origin) -
// entries always require live connectivity; there is no offline write queue.
const CACHE_NAME = 'naghma-ledger-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon.svg',
  './js/config.js',
  './js/auth.js',
  './js/sheetsApi.js',
  './js/ledger.js',
  './js/main.js',
  './js/mockData.js',
  './js/theme.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
