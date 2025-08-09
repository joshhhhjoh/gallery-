const CACHE = 'j-gallery-v36';
const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './offline.html',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k === CACHE ? null : caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // For navigation requests (HTML), serve cached index or offline page
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(res => {
        return res || fetch(req).catch(() => caches.match('./offline.html'));
      })
    );
    return;
  }

  // For same-origin GET requests, use cache-first
  if (url.origin === location.origin && req.method === 'GET') {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match('./offline.html')))
    );
    return;
  }

  // Default: network
  e.respondWith(fetch(req));
});
