let cacheName = "flight-simulator-pwa";
let filesToCache = ["/",
    "/index.html",
    "/css/style.css",
    "/js/main.js",
    "/js/fs-init.js",
    "/js/fs-fly.js",
    "/js/fs-animate.js",
    "/js/fs-main.js",
    "/js/fs-place-objects.js",
    "/js/helpers.js",
    "/manifest.json",
    "/images/logo-black-only-plane.ico",
    "/images/pwa-icon-256.png",
    "/public/threejs/three.js",
    "/public/threejs/extra-utils/loaders/GLTFLoader.js",
    "/public/threejs/extra-utils/objects/Water.js",
    "/public/threejs/extra-utils/objects/Sky.js",
    "/public/threejs/extra-utils/libs/stats.min.js",
    "/public/textures/waternormals.jpg",
    "/public/glb/low-poly_airplane.glb-low"
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

    // check if the request is for a file in the js folder (if so, don't use the cache)
    if (e.request.url.indexOf("/js/") > -1) {
        e.respondWith(
            fetch(e.request).catch(() => {
                console.log("Service Worker: Offline");
                return caches.match(e.request);
            }).then((response) => {
                console.log("Service Worker: Online");
                if (response) return response;
                return fetch(e.request);
            })
        );
        return;
    }

    // otherwise, use the cache
    e.respondWith(
        caches.match(e.request).then((response) => {
            if (response) {
                console.log("Service Worker: Found in cache");
                return response;
            }
            console.log("Service Worker: Not found in cache, fetching...", e.request.url);
            return fetch(e.request);
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