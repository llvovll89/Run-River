/* VERSION and ASSETS are injected by the build. Cache only public app shells. */
const PREFIX = "run-river-offline-";
const CACHE = PREFIX + VERSION;
const PAGES = ["/", "/running", "/result", "/local-history", "/maps"];

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(ASSETS);
        for (const url of PAGES) {
            const response = await fetch(new Request(url, {credentials: "omit", cache: "reload"}));
            if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
                throw new Error("Offline app shell could not be prepared");
            }
            await cache.put(url, response);
        }
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const previous = (await caches.keys()).filter((key) => key.startsWith(PREFIX) && key !== CACHE);
        await Promise.all(previous.slice(0, -1).map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
    const {request} = event;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin) return;
    if (request.mode === "navigate" && PAGES.includes(url.pathname)) {
        event.respondWith((async () => {
            const cached = await (await caches.open(CACHE)).match(url.pathname);
            return cached ?? fetch(request);
        })());
    } else if (ASSETS.includes(url.pathname)) {
        event.respondWith((async () => {
            const response = await (await caches.open(CACHE)).match(url.pathname) ?? await caches.match(url.pathname);
            return response ?? fetch(request);
        })());
    }
    // Never cache auth, server records, API responses, or Next RSC payloads.
});
