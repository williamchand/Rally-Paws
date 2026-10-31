/* Offline shell that stays fresh: network-first for navigations (index.html),
   cache-first for hashed /assets/* (Vite fingerprints them, so a cached copy
   can never be stale), stale-while-revalidate for other static files,
   network-first for API. */
const CACHE = 'rally-shell-v2';
const SHELL = ['/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(res) {
  return res && res.ok;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health')) {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }
  // App shell: always try the network so deploys show up immediately;
  // fall back to cache when offline. Only HTML is stored, under one key.
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const type = res.headers.get('content-type') || '';
          if (cacheable(res) && type.includes('text/html')) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }
  // Hashed build output: the URL changes when bytes change, so cache-first is safe.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then((res) => {
            if (cacheable(res)) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }
  // Other static files: serve cache instantly, refresh in the background.
  event.respondWith(
    caches.match(event.request).then((hit) => {
      const net = fetch(event.request)
        .then((res) => {
          if (cacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
