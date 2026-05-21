const CACHE = 'trading-dash-v1';
const CACHE_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/lightweight-charts.js',
  '/js/socket.io.js',
  '/js/indicators.js',
  '/js/grid-manager.js',
  '/js/data-bridge.js',
  '/js/drawings.js',
  '/js/chart-pane.js',
  '/js/watchlist.js',
  '/js/app.js',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CACHE_FILES))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(network => {
        if (network.ok) {
          const clone = network.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return network;
      });
    })
  );
});
