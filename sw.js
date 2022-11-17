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
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});