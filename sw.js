/* SW: offline shell (v5) */
const CACHE = 'josh-gal-v6';
const CORE = ['./','./index.html','./style.css','./app.js','./manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  try {
    const url = new URL(e.request.url);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== self.location.origin) return;
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
      }).catch(() => caches.match('./index.html')))
    );
  } catch {}
});
