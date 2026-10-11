const CACHE_NAME = "judge-source-app-core10";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css?v=core10",
  "./js/app.js?v=core10",
  "./js/documents.js?v=core10",
  "./js/pdf-library.mjs",
  "./js/import-policy.mjs",
  "./js/sync-controller.mjs",
  "./js/update-config.mjs",
  "./data/classifications.json?v=core10",
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
  const url = new URL(event.request.url);
  // Update checks and relayed PDFs must reach the network; private PDFs live only in IndexedDB.
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok) await (await caches.open(CACHE_NAME)).put(event.request, response.clone());
      return response;
    }).catch(async () => (await caches.match(event.request)) || (await caches.match(new URL("index.html", self.registration.scope).href))));
    return;
  }
  if (event.request.cache === "no-store" || event.request.cache === "no-cache") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
