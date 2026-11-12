const C = "ct-v43";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(["./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"]))); });
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const req = e.request.mode === "navigate" ? new Request(e.request.url, { cache: "no-store" }) : new Request(e.request, { cache: "no-cache" });
  e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html") || caches.match("./"))));
});
