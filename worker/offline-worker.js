/* VERSION and ASSETS are injected by the build. Cache only public app shells. */
const PREFIX = "run-river-offline-";
const CACHE = PREFIX + VERSION;
const PAGES = ["/", "/running", "/result", "/local-history", "/maps", "/hiking"];
const OFFLINE_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Run River</title><style>
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#eceef2;color:#1b2433;text-align:center}
main{padding:24px}a{display:inline-block;margin-top:20px;padding:14px 22px;border-radius:14px;background:#2f4766;color:#fff;text-decoration:none;font-weight:700}
@media (prefers-color-scheme:dark){body{background:#0e1117;color:#e8ebf0}}
</style></head><body><main><h1 style="font-size:20px">인터넷 연결이 필요한 화면이에요</h1>
<p>통계·설정·로그인은 연결된 뒤 다시 열어주세요.<br>운동 기록은 오프라인에서도 계속할 수 있어요.</p>
<a href="/">운동 화면으로</a> <a href="/local-history">기기 기록</a></main></body></html>`;

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
    } else if (request.mode === "navigate") {
        // 기기에 저장하지 않는 화면(통계·설정·로그인)은 연결이 없을 때 브라우저 오류 대신 안내를 보여준다.
        event.respondWith(fetch(request).catch(() => new Response(OFFLINE_HTML, {
            status: 503,
            headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"},
        })));
    } else if (ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/")) {
        // Build files are immutable. A page still running the previous version (updates apply
        // silently) may need its own chunks, which live in the kept previous cache.
        event.respondWith((async () => {
            const response = await (await caches.open(CACHE)).match(url.pathname) ?? await caches.match(url.pathname);
            return response ?? fetch(request);
        })());
    }
    // Never cache auth, server records, API responses, or Next RSC payloads.
});
