const CACHE_NAME = 'browser-ide-v1.1.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
];

self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  (self as any).skipWaiting();
});

self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  (self as any).clients.claim();
});

self.addEventListener('fetch', (event: any) => {
  // Statically serve cached shell & assets offline-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache toolchain runtime assets on demand
        if (
          event.request.url.includes('/runtimes/') ||
          event.request.url.endsWith('.wasm') ||
          event.request.url.endsWith('.js')
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      });
    })
  );
});
