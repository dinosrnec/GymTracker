const CACHE_NAME = "gym-tracker-v2";
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

// Network-first: uvijek pokušaj dohvatiti svježu verziju sa servera i osvježi cache.
// Tek ako nema interneta, posegni za zadnjom spremljenom kopijom (offline rad).
// Ovo sprječava da stara/pokvarena verzija ostane trajno zaglavljena u cacheu
// nakon što se kod na GitHubu promijeni.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("./index.html"))
      )
  );
});
