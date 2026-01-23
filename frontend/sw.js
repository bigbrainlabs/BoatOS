/**
 * BoatOS Service Worker - PWA Support
 * v2 - Skip tile caching
 */

const CACHE_NAME = 'boatos-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/charts.js',
    '/logbook.js',
    '/logbook.css',
    '/i18n.js'
];

// Install - cache resources
self.addEventListener('install', event => {
    self.skipWaiting(); // Activate immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.log('SW install error:', err))
    );
});

// Fetch - skip tiles, serve others from cache
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Don't cache tile requests - let them go directly to network
    if (url.pathname.includes('/tiles/') ||
        url.hostname.includes('openseamap.org') ||
        url.hostname.includes('openstreetmap.org') ||
        url.pathname.endsWith('.pbf') ||
        url.pathname.endsWith('.mvt')) {
        return; // Don't intercept, let browser handle normally
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
            .catch(() => fetch(event.request))
    );
});

// Activate - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control immediately
    );
});
