/**
 * BoatOS Service Worker - PWA Support
 */

const CACHE_NAME = 'boatos-v1';
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
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.log('SW install error:', err))
    );
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
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
        })
    );
});
