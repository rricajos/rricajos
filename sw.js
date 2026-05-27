var CACHE = "rricajos-v25";
var ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./portfolio.js",
  "./avatar.png",
  "./favicon.ico",
  "./css/base.css",
  "./css/superheader.css",
  "./css/supernav.css",
  "./css/superfooter.css",
  "./css/sections.css",
  "./css/section-services.css",
  "./css/section-portfolio.css",
  "./css/section-contact.css",
  "./css/print.css"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
});

self.addEventListener("fetch", function (e) {
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        // Cache successful responses for offline
        if (res.ok && e.request.method === "GET") {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(e.request);
      })
  );
});
