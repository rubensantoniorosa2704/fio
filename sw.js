"use strict";

/* Bump this value on every release so clients drop the old cache. */
const CACHE_NAME = "crochet-studio-v2";

const BULMA_URL = "https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css";
const FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap";

const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
];

const CROSS_ORIGIN_ASSETS = [BULMA_URL, FONT_CSS_URL];

/* Install: store the app shell. Cross-origin stylesheets are fetched with
   no-cors to match how the <link> tags request them (opaque responses).
   The font files themselves are cached at runtime by the fetch handler. */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(LOCAL_ASSETS);
      await Promise.all(
        CROSS_ORIGIN_ASSETS.map((url) => cache.add(new Request(url, { mode: "no-cors" })))
      );
    }).then(() => self.skipWaiting())
  );
});

/* Activate: remove caches from previous versions and take control of open pages. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

/* Fetch: cache first, network second. Successful network responses are stored
   for next time. Offline page navigations fall back to the cached index.html. */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const isCacheable = response.ok || response.type === "opaque";
          if (isCacheable) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        });
    })
  );
});
