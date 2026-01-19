importScripts('/version.js');

const VERSION = self.__MATHIS_COOL_VERSION__ || 'v0';
const CACHE_NAME = 'mathis-cool-' + VERSION;

const ASSETS = [
  '/',
  '/index.html',
  '/version.js',
  '/styles.css',
  '/app.js',
  '/favicon.svg',
  '/manifest.webmanifest'
];

function isAppShell(req) {
  try {
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return false;
    return url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/styles.css' || url.pathname === '/app.js' || url.pathname === '/favicon.svg' || url.pathname === '/manifest.webmanifest';
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  const type = event?.data?.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== self.location.origin) return;

  // Network-first for app shell files to ensure updates are picked up quickly.
  if (isAppShell(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res && res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for everything else (keeps the app snappy and offline-friendly).
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const copy = res.clone();
        if (res && res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
