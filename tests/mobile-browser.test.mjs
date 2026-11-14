import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdir} from "node:fs/promises";
import path from "node:path";
import {chromium} from "playwright";

test("packaged app opens and navigates without external network or a service worker", async () => {
    const root = path.resolve("mobile-dist");
    const mime = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2"};
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
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
