importScripts('/version.js');

const VERSION = self.__MATHIS_COOL_VERSION__ || 'v0';
const CACHE_NAME = 'mathis-cool-' + VERSION;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/version.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.png'
];

const CORE_ASSET_SET = new Set(CORE_ASSETS);
const APP_SHELL_PREFIXES = ['/assets/'];

function normalizeAssetPath(path) {
  if (typeof path !== 'string' || !path.trim()) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return null;
  return path.startsWith('/') ? path : `/${path}`;
}

function dedupeAssets(list) {
  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    const normalized = normalizeAssetPath(item);
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

async function loadManifestAssets() {
  try {
    const response = await fetch(`/manifest.json?sw-bust=${encodeURIComponent(VERSION)}`, {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response || !response.ok) return [];
    const manifest = await response.json();
    const files = [];

    Object.values(manifest || {}).forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      if (entry.file) files.push(entry.file);
      if (Array.isArray(entry.css)) files.push(...entry.css);
      if (Array.isArray(entry.assets)) files.push(...entry.assets);
    });

    return files;
  } catch (error) {
    console.warn('SW manifest fetch failed', error);
    return [];
  }
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const manifestAssets = await loadManifestAssets();
  const targets = dedupeAssets([...CORE_ASSETS, ...manifestAssets]);
  if (!targets.length) return;
  await cache.addAll(targets);
}

function isAppShell(req) {
  try {
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return false;
    if (CORE_ASSET_SET.has(url.pathname)) return true;
    return APP_SHELL_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheAppShell().catch((error) => {
      console.warn('SW install caching failed', error);
      return caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS));
    })
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
