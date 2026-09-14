/* ============================================================
   SERVICE WORKER — offline-first for app shell,
   stale-while-revalidate for weather API calls.
   Bump CACHE_VERSION whenever app files change to force refresh.
   ============================================================ */

const CACHE_VERSION = "v29";
const APP_CACHE = `banff-app-${CACHE_VERSION}`;
const WEATHER_CACHE = `banff-weather-${CACHE_VERSION}`;
const TILE_CACHE = `banff-tiles-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css?v=29",
  "./js/data.js?v=29",
  "./js/store.js?v=29",
  "./js/sync.js?v=29",
  "./js/routing.js?v=29",
  "./js/weather.js?v=29",
  "./js/app.js?v=29",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/calgary.jpg",
  "./images/bow-falls.jpg",
  "./images/moraine-lake.jpg",
  "./images/peyto-lake.jpg",
  "./images/pyramid-lake.jpg",
  "./images/columbia-icefield.jpg",
  "./images/hot-springs.jpg",
  "./images/drumheller.jpg",
  "./images/johnston-canyon.jpg",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/images/marker-icon.png",
  "./vendor/leaflet/images/marker-icon-2x.png",
  "./vendor/leaflet/images/marker-shadow.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_CACHE && k !== WEATHER_CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Trip API: always network — never serve stale saved data from cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Weather API: network-first, cache as fallback (stale-while-revalidate)
  if (url.hostname === "api.open-meteo.com") {
    event.respondWith(
      caches.open(WEATHER_CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(event.request);
          cache.put(event.request, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  // Satellite tiles: network-first, cache as fallback so already-viewed areas work offline
  if (url.hostname === "server.arcgisonline.com") {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(event.request);
          cache.put(event.request, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  // Page navigations (the HTML document itself): network-first, so a deployed
  // update is picked up immediately instead of being stuck on a cached page.
  // Falls back to cache only when actually offline.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((fresh) => {
          caches.open(APP_CACHE).then((cache) => cache.put(event.request, fresh.clone()));
          return fresh;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // JS/CSS: network-first so deploys are never stuck on stale cached code.
  if (url.origin === self.location.origin && /\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((fresh) => {
          caches.open(APP_CACHE).then((cache) => cache.put(event.request, fresh.clone()));
          return fresh;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Other same-origin static assets: cache-first (busted by CACHE_VERSION on deploy)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
