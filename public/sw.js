const cacheName = "pitchmate-public-offline-v1";
const browserPages = new Set(["/", "/turfs"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.add("/offline.html")));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name.startsWith("pitchmate-public-offline-") && name !== cacheName).map((name) => caches.delete(name)),
  )));
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" ||
      url.origin !== self.location.origin || !browserPages.has(url.pathname)) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match("/offline.html")) ?? Response.error();
  }));
});
