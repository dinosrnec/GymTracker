const CACHE_NAME = "gym-tracker-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/db.js",
  "./js/gamification.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for app shell, network-falling-back-to-cache for everything else (e.g. CDN chart lib)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // only cache successful, basic/opaque same-type responses
            if (res.status === 200) cache.put(req, resClone);
          });
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
