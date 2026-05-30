const CACHE_NAME = "summon-happys-pwa-v39";
const OFFLINE_URL = "offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "manifest.json",
  "apple-touch-icon.png",
  "pwa-icon-192.png",
  "pwa-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL))
  );
});
