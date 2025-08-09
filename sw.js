// sw.js — J//Gallery v3.1 PWA
const CACHE = 'jgallery-v3.1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE && caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // For same-origin navigations, try network, fallback to cache, then offline page
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        return net;
      } catch (err) {
        const cache = await caches.match('./index.html') || await caches.match('./offline.html');
        return cache;
      }
    })());
    return;
  }

  // For same-origin assets: cache-first
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, net.clone());
        return net;
      } catch {
        // fallback for CSS/JS/IMG
        const fallback = await caches.match('./offline.html');
        return fallback || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // Cross-origin: network-first, then cache
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      return net;
    } catch {
      const cached = await caches.match(req);
      return cached || new Response('', { status: 504 });
    }
  })());
});
