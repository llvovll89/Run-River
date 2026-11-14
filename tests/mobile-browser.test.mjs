import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdir} from "node:fs/promises";
import path from "node:path";
import {chromium} from "playwright";

test("packaged app opens and navigates without external network or a service worker", async () => {
    const root = path.resolve("mobile-dist");
    const mime = {".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2"};
    const server = createServer(async (req, res) => {
        try {
            let file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
            if (!file.startsWith(root + path.sep) && file !== root) throw new Error("outside bundle");
            if (!path.extname(file)) file = path.join(file, "index.html");
            const body = await readFile(file);
            res.writeHead(200, {"Content-Type": mime[path.extname(file)] || "application/octet-stream"});
            res.end(body);
        } catch { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = await chromium.launch();
        const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce"});
        await context.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(origin, {waitUntil: "networkidle"});
        await page.getByTestId("offline-setup").filter({hasText: "앱 화면은 기기에 저장돼요"}).waitFor();
        assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
        await page.evaluate(() => sessionStorage.setItem("runConfig", JSON.stringify({startPoint: {lat: 37.5665, lng: 126.978}, endPoint: null, activityType: "walking", goalDistance: 3, goalTime: null})));
        await page.goto(origin + "/running/", {waitUntil: "networkidle"});
        await page.getByText("일시정지", {exact: true}).first().waitFor();
        await page.goto(origin + "/local-history/", {waitUntil: "networkidle"});
        await page.getByRole("heading", {name: "이 기기의 운동 기록", exact: true}).waitFor();
        await mkdir("output/playwright", {recursive: true});
        await page.screenshot({path: "output/playwright/mobile-bundle.png"});
        assert.deepEqual(errors, []);
        const nativeContext = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce"});
        await nativeContext.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
        await nativeContext.addInitScript(() => {
            window.androidBridge = {};
            window.Capacitor = {
                PluginHeaders: [{name: "NativeRun", methods: ["start", "snapshot", "pause", "resume", "finish", "acknowledge"].map(name => ({name, rtype: "promise"}))}],
                nativePromise: async (plugin, method, options) => {
                    const read = () => JSON.parse(localStorage.getItem("mock-native-run") || "null");
                    let run = read();
                    if (method === "start") {
                        run = {config: options.config, status: "recording", elapsedMs: 120000, distanceKm: 0.1, elevationGain: 15, elevationLoss: 0, trackPoints: [{lat: 37.6, lng: 127, timestamp: Date.now(), distance_km: 0.1, elapsed_seconds: 120, altitude_m: 100}], position: {lat: 37.6, lng: 127}, lastFixAt: Date.now(), accuracy: 5};
                    } else if (method === "pause") run.status = "paused";
                    else if (method === "resume") run.status = "recording";
                    else if (method === "finish") run.status = "finished";
                    else if (method === "acknowledge") { localStorage.setItem("native-export-acknowledged", "true"); run = null; }
                    if (method !== "snapshot") localStorage.setItem("mock-native-run", JSON.stringify(run));
                    return method === "snapshot" ? {run} : {};
                },
            };
            if (!sessionStorage.getItem("native-config-created")) {
                sessionStorage.setItem("native-config-created", "true");
                sessionStorage.setItem("runConfig", JSON.stringify({runId: "native-test-1", startPoint: {lat: 37.6, lng: 127}, endPoint: null, activityType: "walking", goalDistance: 3, goalTime: null}));
            }
        });
        const nativePage = await nativeContext.newPage();
        nativePage.setDefaultTimeout(15000);
        nativePage.on("pageerror", error => errors.push(error.message));
        await nativePage.goto(origin + "/running/", {waitUntil: "networkidle"});
        await nativePage.getByRole("button", {name: "일시정지", exact: true}).click();
        await nativePage.reload({waitUntil: "networkidle"});
        await nativePage.getByRole("button", {name: "기록 재개", exact: true}).click();
        await nativePage.getByRole("button", {name: "운동 종료", exact: true}).click();
        await nativePage.getByRole("button", {name: "종료 확인", exact: true}).click();
        await nativePage.getByRole("button", {name: "결과 저장하기", exact: true}).waitFor();
        await nativePage.getByRole("heading", {name: "운동을 마쳤어요", exact: true}).scrollIntoViewIfNeeded();
        await nativePage.screenshot({path: "output/playwright/native-recording.png", fullPage: true});
        await nativePage.evaluate(() => {
            const original = Storage.prototype.setItem;
            window.restoreNativeStorage = () => { Storage.prototype.setItem = original; };
            Storage.prototype.setItem = function(key, value) { if (key === "rr_local_results") throw new DOMException("Storage full", "QuotaExceededError"); return original.call(this, key, value); };
        });
        await nativePage.getByRole("button", {name: "결과 저장하기", exact: true}).click();
        await nativePage.getByRole("alert").filter({hasText: "Storage full"}).waitFor();
        assert.equal(await nativePage.evaluate(() => localStorage.getItem("native-export-acknowledged")), null);
        await nativePage.evaluate(() => window.restoreNativeStorage());
        await nativePage.getByRole("button", {name: "결과 저장하기", exact: true}).click();
        await nativePage.waitForURL("**/result?id=native-test-1");
        assert.equal(await nativePage.evaluate(() => JSON.parse(localStorage.getItem("rr_local_results"))[0].result.distance_km), 0.1);
        assert.equal(await nativePage.evaluate(() => localStorage.getItem("native-export-acknowledged")), "true");
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
