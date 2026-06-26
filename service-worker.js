const CACHE_NAME = "judge-source-app-core6";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./css/style.css?v=core1",
  "./css/style.css?v=core2",
  "./css/style.css?v=core3",
  "./css/style.css?v=core4",
  "./css/style.css?v=core5",
  "./css/style.css?v=core6",
  "./js/app.js",
  "./js/app.js?v=core1",
  "./js/app.js?v=core2",
  "./js/app.js?v=core3",
  "./js/app.js?v=core4",
  "./js/app.js?v=core5",
  "./js/app.js?v=core6",
  "./js/documents.js",
  "./js/documents.js?v=core1",
  "./js/documents.js?v=core2",
  "./js/documents.js?v=core3",
  "./js/documents.js?v=core4",
  "./js/documents.js?v=core5",
  "./js/documents.js?v=core6",
  "./data/classifications.json",
  "./data/classifications.json?v=core2",
  "./data/classifications.json?v=core3",
  "./data/classifications.json?v=core4",
  "./data/classifications.json?v=core5",
  "./data/classifications.json?v=core6",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
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

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
