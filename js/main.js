window.onload = () => {
    "use strict";

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js");
    }

    try {
        // this is for logging only (can be removed in production)
        fetch('https://traffic-logger.brandenburger.dev/api/create-log', {
            method: 'POST',
            body: JSON.stringify({ app: 'flight-simulator-pwa', userAgent: navigator.userAgent }),
        })
    } catch (error) { }
};