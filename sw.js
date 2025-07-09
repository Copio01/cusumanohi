/**
 * Service Worker - Cusumano Home Improvements
 *
 * This service worker handles:
 * - Caching of critical assets for offline use
 * - Serving cached assets to improve performance
 * - Dynamic caching for visited pages
 * - Background updates for fresh content
 */

// Cache names for different types of assets
const CACHE_NAMES = {
    static: 'static-cache-v1',
    images: 'images-cache-v1',
    fonts: 'fonts-cache-v1',
    pages: 'pages-cache-v1'
};

// Assets to cache immediately when service worker is installed
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/performance-test.html',
    '/css/tailwind.output.css',
    '/js/config.js',
    '/js/critical-resource-preloader.js',
    '/js/intelligent-image-loader.js',
    '/js/performance-benchmark.js',
    '/js/optimization-toggle.js',
    '/js/sw-register.js',
    '/images/logo.svg',
    '/images/hero-banner.jpg',
    // Add more critical assets here that should be available offline
];

// Cache expiration settings (in milliseconds)
const EXPIRATION_TIMES = {
    static: 30 * 24 * 60 * 60 * 1000, // 30 days
    images: 7 * 24 * 60 * 60 * 1000,  // 7 days
    fonts: 60 * 24 * 60 * 60 * 1000,  // 60 days
    pages: 24 * 60 * 60 * 1000        // 24 hours
};

// Install event - cache critical assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing Service Worker...');
    
    event.waitUntil(
        Promise.all(
            Object.values(CACHE_NAMES).map(cacheName => {
                return caches.open(cacheName);
            })
        )
        .then(cacheList => {
            // Get the static cache
            const staticCache = cacheList[0];
            // Precache static assets
            return staticCache.addAll(PRECACHE_ASSETS);
        })
        .then(() => {
            console.log('[Service Worker] Precaching complete');
            return self.skipWaiting();
        })
        .catch(error => {
            console.error('[Service Worker] Precaching failed:', error);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating Service Worker...');
    
    event.waitUntil(
        // Get all cache keys
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Delete any cache that isn't in our current cache list
                        if (!Object.values(CACHE_NAMES).includes(cacheName)) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Claiming clients...');
                return self.clients.claim();
            })
    );
});

// Message event - handle messages from the client
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
    const request = event.request;
    
    // Only handle GET requests
    if (request.method !== 'GET') return;
    
    // Skip non-HTTP(s) requests
    if (!request.url.startsWith('http')) return;
    
    // Skip Google Analytics and other tracking requests
    if (request.url.includes('google-analytics.com') || 
        request.url.includes('googletagmanager.com') ||
        request.url.includes('analytics') ||
        request.url.includes('tracking')) {
        return;
    }
    
    // Handle the request based on resource type
    const url = new URL(request.url);
    
    // Use different strategies based on resource type
    if (isStaticAsset(url)) {
        // Static assets - Cache First strategy
        event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.static));
    } else if (isImageAsset(url)) {
        // Images - Cache First with network fallback
        event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.images));
    } else if (isFontAsset(url)) {
        // Fonts - Cache First with long expiration
        event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.fonts));
    } else if (isHTMLPage(request)) {
        // HTML pages - Network First with cache fallback
        event.respondWith(networkFirstStrategy(request, CACHE_NAMES.pages));
    } else {
        // Everything else - Stale While Revalidate
        event.respondWith(staleWhileRevalidateStrategy(request));
    }
});

/**
 * Cache First Strategy
 * Try cache first, then network. If network succeeds, update cache.
 */
async function cacheFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    // Try to get from cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        // Return cached response and update cache in background
        updateCacheInBackground(request, cache);
        return cachedResponse;
    }
    
    // If not in cache, get from network
    try {
        const networkResponse = await fetch(request);
        
        // Cache the response (if valid)
        if (networkResponse && networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            cache.put(request, clonedResponse);
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);
        // For images, can return a fallback
        if (isImageAsset(new URL(request.url))) {
            return caches.match('/images/placeholder.jpg');
        }
        
        // Otherwise just propagate the error
        throw error;
    }
}

/**
 * Network First Strategy
 * Try network first, then cache. If network succeeds, update cache.
 */
async function networkFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache the response
        if (networkResponse && networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            cache.put(request, clonedResponse);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Network request failed, falling back to cache');
        
        // If network fails, try cache
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If HTML request, try to serve index.html from cache
        if (isHTMLPage(request)) {
            return cache.match('/index.html');
        }
        
        // Otherwise propagate the error
        throw error;
    }
}

/**
 * Stale While Revalidate Strategy
 * Return cached version if available, but fetch and cache update in background
 */
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(CACHE_NAMES.static);
    
    // Try to get from cache
    const cachedResponse = await cache.match(request);
    
    // Clone the request for the fetch call
    const fetchPromise = fetch(request).then(networkResponse => {
        // Cache the new response
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(error => {
        console.error('[Service Worker] Fetch failed:', error);
    });
    
    // Return the cached response immediately, or wait for the network
    return cachedResponse || fetchPromise;
}

/**
 * Update cache in background without delaying response
 */
function updateCacheInBackground(request, cache) {
    fetch(request)
        .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse);
            }
        })
        .catch(error => {
            console.error('[Service Worker] Background update failed:', error);
        });
}

/**
 * Helper functions to identify asset types
 */
function isStaticAsset(url) {
    const path = url.pathname;
    return path.endsWith('.js') || 
           path.endsWith('.css') || 
           path.endsWith('.json');
}

function isImageAsset(url) {
    const path = url.pathname;
    return path.endsWith('.jpg') || 
           path.endsWith('.jpeg') || 
           path.endsWith('.png') || 
           path.endsWith('.gif') || 
           path.endsWith('.svg') || 
           path.endsWith('.webp');
}

function isFontAsset(url) {
    const path = url.pathname;
    return path.endsWith('.woff') || 
           path.endsWith('.woff2') || 
           path.endsWith('.ttf') || 
           path.endsWith('.otf') ||
           url.hostname.includes('fonts.gstatic.com');
}

function isHTMLPage(request) {
    return request.headers.get('accept')?.includes('text/html') &&
           request.mode === 'navigate';
}

/**
 * Clean expired items from cache
 * This runs periodically to keep cache size manageable
 */
self.addEventListener('periodicsync', event => {
    if (event.tag === 'cache-cleanup') {
        event.waitUntil(cleanupExpiredCache());
    }
});

// Also clean cache on activate
self.addEventListener('activate', event => {
    event.waitUntil(cleanupExpiredCache());
});

/**
 * Clean expired items from all caches
 */
async function cleanupExpiredCache() {
    const now = Date.now();
    
    for (const [cacheType, cacheName] of Object.entries(CACHE_NAMES)) {
        const expirationTime = EXPIRATION_TIMES[cacheType];
        const cache = await caches.open(cacheName);
        
        // Get all cache entries
        const requests = await cache.keys();
        
        // Process each request
        for (const request of requests) {
            // Get cached response
            const response = await cache.match(request);
            
            // Skip if no response
            if (!response) continue;
            
            // Check timestamp in headers
            const timestamp = parseInt(response.headers.get('sw-timestamp') || '0');
            
            // If timestamp is too old, delete from cache
            if (timestamp && now - timestamp > expirationTime) {
                console.log(`[Service Worker] Removing expired item from ${cacheType} cache:`, request.url);
                await cache.delete(request);
            }
        }
    }
    
    console.log('[Service Worker] Cache cleanup complete');
}
