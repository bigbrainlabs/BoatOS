/**
 * BoatOS Service Worker - PWA Support
 * v3 - Network-First strategy (always serve fresh content, cache as fallback)
 */

const CACHE_NAME = 'boatos-v8';
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

// Fetch - Network-First: always try network, fall back to cache
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

    // Don't cache API or WebSocket requests
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clone and update cache with fresh response
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Network failed - serve from cache (offline fallback)
                return caches.match(event.request);
            })
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
