// TM Progressive Web App Service Worker
const CACHE_NAME = 'tm-app-cache-v6';

const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg',
  'css/style.css',
  'js/shamsi.js',
  'js/data-engine.js',
  'js/gdrive-sync.js',
  'js/app.js',
  'vendor/tailwind.min.js',
  'vendor/fontawesome/css/all.min.css',
  'vendor/fontawesome/webfonts/fa-solid-900.woff2',
  'vendor/fontawesome/webfonts/fa-regular-400.woff2',
  'vendor/fontawesome/webfonts/fa-brands-400.woff2',
  'vendor/vazirmatn/vazirmatn.css',
  'vendor/vazirmatn/Vazirmatn-Regular.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          const fullUrl = new URL(asset, self.registration.scope).toString();
          await cache.add(fullUrl);
        } catch (e) {
          console.warn(`[SW] Could not pre-cache ${asset}:`, e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Do not intercept API requests or external Google OAuth/Drive APIs in the service worker
  if (requestUrl.pathname.startsWith('/api/') || 
      requestUrl.hostname.includes('googleapis.com') ||
      requestUrl.hostname.includes('accounts.google.com') ||
      requestUrl.hostname.includes('script.google.com')) {
    return;
  }

  // 1. Navigation Requests (HTML Pages): Network-First with Offline Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(event.request);
          if (networkRes && networkRes.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        } catch (err) {
          const indexUrl = new URL('index.html', self.registration.scope).toString();
          const fallback = (await caches.match(event.request)) || (await caches.match(indexUrl)) || (await caches.match('./index.html'));
          if (fallback) return fallback;
          throw err;
        }
      })()
    );
    return;
  }

  // 2. Static Assets: Cache-First with Background Revalidation
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        // Revalidate in background
        fetch(event.request).then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse);
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache: fetch from network
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, responseToCache);
        }
        return networkResponse;
      } catch (err) {
        return cachedResponse || new Response('Offline asset not found', { status: 503 });
      }
    })()
  );
});

// Handle notification clicks in Service Worker
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
