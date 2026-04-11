/**
 * BoatOS Service Worker - PWA Support
 * v9 - Network-First for app files + persistent Cache-First for satellite tiles
 */

// App shell cache — bump this version on any app update
const CACHE_NAME = 'boatos-v9';

// Satellite tile cache — intentionally versioned separately so it is NEVER
// wiped when the app cache version changes (tiles take a long time to download)
const SATELLITE_CACHE_NAME = 'satellite-tiles-v1';

// 1×1 grey PNG returned when a satellite tile is not cached and the network
// is unavailable — keeps the map rendering cleanly instead of broken tiles
const GREY_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/charts.js',
    '/logbook.js',
    '/logbook.css',
    '/i18n.js'
];

// ---------------------------------------------------------------------------
// Install — pre-cache app shell resources
// ---------------------------------------------------------------------------
self.addEventListener('install', event => {
    self.skipWaiting(); // Activate immediately, don't wait for old SW to die
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.log('SW install error:', err))
    );
});

// ---------------------------------------------------------------------------
// Activate — delete stale boatos-vX caches; NEVER touch satellite-tiles-vX
// ---------------------------------------------------------------------------
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Keep the current app cache
                    if (cacheName === CACHE_NAME) return;
                    // Keep ALL satellite tile caches (any version)
                    if (cacheName.startsWith('satellite-tiles-')) return;
                    // Delete everything else (old boatos-vX caches)
                    console.log('SW: deleting old cache', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim()) // Take control of all open pages
    );
});

// ---------------------------------------------------------------------------
// Fetch — route requests to the appropriate strategy
// ---------------------------------------------------------------------------
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // --- Satellite tiles (ESRI ArcGIS Online): Cache-First ---
    if (url.hostname.includes('server.arcgisonline.com')) {
        event.respondWith(handleSatelliteTile(event.request));
        return;
    }

    // --- Tile requests from other sources: pass through, do not cache ---
    if (url.pathname.includes('/tiles/') ||
        url.hostname.includes('openseamap.org') ||
        url.hostname.includes('openstreetmap.org') ||
        url.pathname.endsWith('.pbf') ||
        url.pathname.endsWith('.mvt')) {
        return; // Let the browser handle these directly
    }

    // --- API and WebSocket requests: pass through, never cache ---
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
        return;
    }

    // --- App shell resources: Network-First with cache fallback ---
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Store fresh copy in app cache for offline use
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Network failed — serve stale copy from cache
                return caches.match(event.request);
            })
    );
});

/**
 * Cache-First strategy for satellite tiles.
 * Serve from cache when available; fetch and cache on miss.
 * Return a grey 1×1 pixel PNG if both cache and network are unavailable.
 */
async function handleSatelliteTile(request) {
    const cache = await caches.open(SATELLITE_CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
        return cached; // Cache hit — return immediately without touching network
    }

    // Cache miss — try network
    try {
        const networkResponse = await fetch(request);
        // Only cache successful responses (status 200)
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (_err) {
        // Network unavailable and tile not cached — return grey fallback tile
        console.log('SW: satellite tile unavailable, returning fallback:', request.url);
        return greyPixelResponse();
    }
}

/**
 * Build a Response containing the 1×1 grey fallback PNG from the base64 literal.
 */
function greyPixelResponse() {
    const base64 = GREY_PIXEL_PNG.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Response(bytes.buffer, {
        status: 200,
        headers: { 'Content-Type': 'image/png' }
    });
}

// ---------------------------------------------------------------------------
// Message — handle tile pre-caching requests from the main app
//
// Expected message shape:
//   { type: 'CACHE_SATELLITE_TILES', urls: ['https://...', ...] }
//
// Progress messages sent back to ALL clients:
//   { type: 'CACHE_PROGRESS', done: N, total: N }   — after each tile
//   { type: 'CACHE_COMPLETE' }                       — when batch is done
// ---------------------------------------------------------------------------
self.addEventListener('message', event => {
    if (!event.data || event.data.type !== 'CACHE_SATELLITE_TILES') return;

    const urls = event.data.urls;
    if (!Array.isArray(urls) || urls.length === 0) return;

    event.waitUntil(cacheSatelliteTiles(urls));
});

async function cacheSatelliteTiles(urls) {
    const cache = await caches.open(SATELLITE_CACHE_NAME);
    const total = urls.length;
    let done = 0;

    for (const url of urls) {
        try {
            // Skip tiles already in cache to avoid redundant network requests
            const existing = await cache.match(url);
            if (!existing) {
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                }
            }
        } catch (err) {
            // Non-fatal — log and continue with remaining tiles
            console.warn('SW: failed to cache satellite tile:', url, err);
        }

        done++;
        await broadcastToClients({ type: 'CACHE_PROGRESS', done, total });
    }

    await broadcastToClients({ type: 'CACHE_COMPLETE' });
}

/** Send a message to every open client (tab/window) controlled by this SW. */
async function broadcastToClients(message) {
    const clients = await self.clients.matchAll({ includeUncontrolled: false });
    for (const client of clients) {
        client.postMessage(message);
    }
}
