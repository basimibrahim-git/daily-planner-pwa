const CACHE_NAME = 'planner-shell-v8';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/api.js',
  './js/data.js',
  './js/db-local.js',
  './js/install.js',
  './js/ui-auth.js',
  './js/ui-checklist.js',
  './js/ui-color-picker.js',
  './js/ui-common.js',
  './js/ui-dashboard.js',
  './js/ui-gratitude.js',
  './js/ui-history.js',
  './js/ui-item-form.js',
  './js/ui-manage.js',
  './js/ui-mood.js',
  './js/ui-today.js',
  './js/utils.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/Caveat.woff2',
  './fonts/Quicksand.woff2',
  './fonts/NotoNaskhArabic.woff2',
  './fonts/DancingScript.woff2',
  './fonts/PatrickHand.woff2',
  './fonts/SpecialElite.woff2',
  './fonts/PlayfairDisplay.woff2',
  './fonts/PlayfairDisplay-Italic.woff2',
];

// Fetches a URL with a cache-busting query so a CDN's edge cache can't hand
// back an old response for it, but stores/returns it under the plain URL so
// callers (and later caches.match(request)) still match on it normally.
function fetchFresh(plainUrl, options) {
  const busted = new URL(plainUrl, self.location.href);
  busted.searchParams.set('_swv', CACHE_NAME);
  return fetch(busted.toString(), options);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) =>
            fetchFresh(url).then((response) => {
              if (!response.ok) throw new Error(`Precache failed for ${url}: ${response.status}`);
              return cache.put(url, response);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only ever handle same-origin requests. Anything cross-origin (analytics,
  // a CDN script, etc.) should just go straight to the network unmodified —
  // re-issuing it via fetch() from inside the service worker subjects it to
  // connect-src instead of whatever directive normally governs it, which can
  // trip a site-wide CSP that never expected the service worker to be involved.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept the API — it needs to hit the network (or fail) so the
  // app's own offline queue in js/api.js can take over.
  if (url.pathname.includes('/api/')) {
    return;
  }

  // Network-first, with a cache-busting query tied to CACHE_NAME on the
  // actual network request. This host stamps every static file with a
  // year-long `immutable` Cache-Control, and a CDN in front of it honors that
  // literally — so a plain re-fetch of the same URL can keep being served an
  // old edge-cached copy indefinitely, no matter how fresh the origin file
  // is. Requesting a URL that's never been seen before is the only thing
  // that reliably forces a real trip to the origin through a cache like
  // that. The page never sees the busted URL — respondWith() just returns
  // whatever content comes back for the request it made.
  // fetch() can't replicate mode:'navigate' (only a real navigation may use
  // it), so treat it as 'same-origin' — equivalent here since we already
  // filtered to same-origin URLs above.
  const fetchOptions = {
    headers: request.headers,
    mode: request.mode === 'navigate' ? 'same-origin' : request.mode,
    credentials: request.credentials,
    redirect: request.redirect,
  };

  if (request.mode === 'navigate') {
    event.respondWith(
      fetchFresh(url.pathname + url.search, fetchOptions).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetchFresh(url.pathname + url.search, fetchOptions)
      .then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
