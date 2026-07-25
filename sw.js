const CACHE_NAME = 'private-line-v2';
const FILES_TO_CACHE = [
  './index.html',
  './app.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Only intercept requests for our own known static files.
// Everything else (storage calls, API calls, external resources) goes straight to the network untouched.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isOwnOrigin = url.origin === self.location.origin;
  const isStaticFile = FILES_TO_CACHE.some((f) => url.pathname.endsWith(f.replace('./', '/')));

  if (!isOwnOrigin || !isStaticFile || event.request.method !== 'GET') {
    // Let the browser handle it normally — no caching, no interception.
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
