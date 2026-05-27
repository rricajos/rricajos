var CACHE = "rricajos-v36";
var ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./portfolio.js",
  "./avatar.png",
  "./favicon.svg",
  "./favicon.ico",
  "./robots.txt",
  "./404.html",
  "./privacidad.html",
  "./css/base.css",
  "./css/fonts.css",
  "./css/superheader.css",
  "./css/supernav.css",
  "./css/superfooter.css",
  "./css/sections.css",
  "./css/section-services.css",
  "./css/section-portfolio.css",
  "./css/section-contact.css",
  "./css/print.css",
  "./fonts/poppins-400-latin.woff2",
  "./fonts/poppins-400-latin-ext.woff2",
  "./fonts/poppins-600-latin.woff2",
  "./fonts/poppins-600-latin-ext.woff2",
  "./og-card.svg"
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
        if (e.request.mode === "navigate") {
          return caches.match("./404.html");
        }
        return caches.match(e.request);
      })
  );
});
