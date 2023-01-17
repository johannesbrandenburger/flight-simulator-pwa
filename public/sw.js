let cacheName = "flight-simulator-pwa";
let filesToCache = ["/",
    "/index.html",
    "/manifest.json",
    "/pwa-icon-256.png",
    "/logo-black-only-plane.ico",
    "/assets*",
    "/*",
];


/* Start the service worker and cache all of the app's content */
self.addEventListener("install", (e) => {
    console.log("Service Worker: Installing...");
    e.waitUntil(
        caches.open(cacheName).then(function (cache) {
            return cache.addAll(filesToCache);
        })
    );
});

/* Serve cached content when offline */
self.addEventListener("fetch", (e) => {
    console.log("Service Worker: Fetching...");
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});

/* Update a service worker */
self.addEventListener("activate", (e) => {
    console.log("Service Worker: Activating...");
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== cacheName) {
                    return caches.delete(key);
                }
            }));
        })
    );
});