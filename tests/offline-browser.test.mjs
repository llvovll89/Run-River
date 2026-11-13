import {test, before, after} from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import http from "node:http";
import {chromium, webkit, devices} from "playwright";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), false);
const origin = "http://127.0.0.1:3137";
let server;
let proxy;
const api = {userId: null, rows: new Map(), inserts: 0, authRequests: 0};
function mockUser() {
    return {id: api.userId, aud: "authenticated", role: "authenticated", email: "test@example.invalid", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString()};
}
before(async () => {
    await mkdir("output/playwright", {recursive: true});
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3138"], {stdio: "ignore"});
    proxy = http.createServer(async (request, response) => {
        const url = new URL(request.url, origin);
        const json = (value, status = 200) => { response.writeHead(status, {"Content-Type": "application/json"}); response.end(JSON.stringify(value)); };
        if (url.pathname === "/auth/v1/user") { api.authRequests++; return json(mockUser()); }
        if (url.pathname === "/rest/v1/user_profiles") return json(null);
        if (url.pathname === "/rest/v1/running_records") {
            if (request.method === "POST") {
                let body = "";
                for await (const chunk of request) body += chunk;
                const record = JSON.parse(body)[0];
                api.inserts++;
                if (record.user_id !== api.userId) return json({message: "RLS denied"}, 403);
                if (api.rows.has(record.id)) return json({code: "23505", message: "duplicate"}, 409);
                api.rows.set(record.id, {...record, created_at: new Date().toISOString(), memo: null});
                response.destroy(); // Committed on the simulated server; response lost.
                return;
            }
            return json(request.headers.accept?.includes("vnd.pgrst.object") ? [...api.rows.values()][0] : [...api.rows.values()]);
        }
        const upstream = http.request({hostname: "127.0.0.1", port: 3138, path: request.url, method: request.method, headers: request.headers}, (result) => {response.writeHead(result.statusCode, result.headers); result.pipe(response);});
        upstream.on("error", () => {response.writeHead(502); response.end();});
        request.pipe(upstream);
    });
    await new Promise((resolve) => proxy.listen(3137, "127.0.0.1", resolve));
    for (let i = 0; i < 100; i++) {
        try { if ((await fetch(origin)).ok) return; } catch {}
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("Production server did not start");
});
after(async () => { server?.kill(); await new Promise((resolve) => proxy?.close(resolve)); });

async function prepare(browserType) {
    const browser = await browserType.launch();
    const context = await browser.newContext({
        ...devices["iPhone 13"], defaultBrowserType: undefined,
        permissions: ["geolocation"], geolocation: {latitude: 37.5665, longitude: 126.978, accuracy: 5},
    });
    // Deterministic GPS callbacks model satellite fixes independently of network
    // emulation. This does not claim to test a phone's physical GPS hardware.
    await context.addInitScript(() => {
        let nextId = 1;
        let position = {coords: {latitude: 37.5665, longitude: 126.978, accuracy: 5, altitude: null, altitudeAccuracy: null, speed: null, heading: null}, timestamp: Date.now()};
        const watchers = new Map();
        window.setTestGPS = (latitude, longitude, accuracy = 5) => {
            position = {coords: {...position.coords, latitude, longitude, accuracy}, timestamp: Date.now()};
            for (const callback of watchers.values()) callback(position);
        };
        Object.defineProperty(navigator, "geolocation", {value: {
            getCurrentPosition(callback) { setTimeout(() => callback({...position, timestamp: Date.now()}), 0); },
            watchPosition(callback) { const id = nextId++; watchers.set(id, callback); setTimeout(() => { if (watchers.has(id)) callback({...position, timestamp: Date.now()}); }, 0); return id; },
            clearWatch(id) { watchers.delete(id); },
        }});
    });
    await context.route("**/*", (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(origin);
    await page.getByTestId("offline-setup").filter({hasText: "준비 완료"}).waitFor({state: "attached", timeout: 45000});
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    return {browser, context, page};
}

for (const [name, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
    test(`${name}: offline GPS, tab restart, paused recovery, durable guest result`, {timeout: 120000}, async () => {
        const {browser, context, page} = await prepare(type);
        try {
            await page.screenshot({path: `output/playwright/home-${name}.png`});
            assert.ok(await page.evaluate(() => document.body.scrollHeight <= window.innerHeight + 1));
            await context.setOffline(true);
            await page.reload();
            await page.getByRole("button", {name: "거리", exact: true}).click();
            await page.getByRole("button", {name: "5km 달리기 시작", exact: true}).click();
            await page.waitForURL("**/running");
            await page.waitForFunction(() => JSON.parse(localStorage.getItem("rr_active_run"))?.pathPoints.length > 0);
            await new Promise((resolve) => setTimeout(resolve, 2200));
            await page.evaluate(() => window.setTestGPS(37.5666, 126.978, 100));
            await page.getByText(/GPS 정확도가 낮아요/).waitFor();
            assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("rr_active_run")).totalDistance), 0);
            await page.evaluate(() => window.setTestGPS(37.5666, 126.978));
            await page.waitForFunction(() => JSON.parse(localStorage.getItem("rr_active_run"))?.totalDistance > 0.005);
            await page.getByTestId("offline-route").waitFor();
            await page.screenshot({path: `output/playwright/offline-${name}.png`});
            const distance = await page.evaluate(() => JSON.parse(localStorage.getItem("rr_active_run")).totalDistance);
            await page.getByRole("button", {name: "일시정지", exact: true}).click();
            // A new tab has no sessionStorage. The device copy must still recover.
            await page.close();
            const recovered = await context.newPage();
            recovered.setDefaultTimeout(15000);
            await recovered.goto(`${origin}/running`);
            await recovered.getByRole("heading", {name: "러닝 기록을 찾았어요"}).waitFor();
            await recovered.getByRole("button", {name: "이어하기", exact: true}).click();
            await recovered.getByRole("button", {name: "계속하기", exact: true}).waitFor();
            assert.equal(await recovered.evaluate(() => JSON.parse(localStorage.getItem("rr_active_run")).totalDistance), distance);
            await context.setOffline(false);
            await new Promise((resolve) => setTimeout(resolve, 300));
            assert.equal(new URL(recovered.url()).pathname, "/running");
            assert.equal(await recovered.evaluate(() => JSON.parse(localStorage.getItem("rr_active_run")).totalDistance), distance);
            await context.setOffline(true);
            await recovered.evaluate(() => {
                const original = Storage.prototype.setItem;
                window.restoreTestStorage = () => { Storage.prototype.setItem = original; };
                Storage.prototype.setItem = function(key, value) {
                    if (key === "rr_local_results") throw new DOMException("Full", "QuotaExceededError");
                    return original.call(this, key, value);
                };
            });
            await recovered.getByRole("button", {name: "종료", exact: true}).click();
            await recovered.getByText("완료 기록을 저장하지 못했어요. 저장 공간을 확보한 뒤 종료를 다시 눌러주세요.").waitFor();
            assert.ok(await recovered.evaluate(() => localStorage.getItem("rr_active_run")));
            await recovered.evaluate(() => window.restoreTestStorage());
            await recovered.getByRole("button", {name: "종료", exact: true}).click();
            await recovered.waitForURL("**/result?id=*");
            await recovered.getByText("기기에 저장됨 · 게스트 기록은 이 기기에 보관돼요").waitFor();
            const result = await recovered.evaluate(() => JSON.parse(localStorage.getItem("rr_local_results"))[0]);
            assert.ok(result.result.pathPoints.length >= 2);
            assert.ok(result.result.distance_km > 0);
            assert.equal(await recovered.evaluate(() => localStorage.getItem("rr_active_run")), null);
            await recovered.reload();
            await recovered.getByText("기기에 저장됨 · 게스트 기록은 이 기기에 보관돼요").waitFor();
            await recovered.goto(`${origin}/local-history`);
            await recovered.getByRole("heading", {name: "이 기기의 운동 기록"}).waitFor();
            await recovered.locator('a[href^="/result?id="]').first().waitFor();
            assert.equal(await recovered.locator('a[href^="/result?id="]').count(), 1);
            const cachedPaths = await recovered.evaluate(async () => {
                const keys = await caches.keys();
                return (await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).map((request) => new URL(request.url).pathname)))).flat();
            });
            for (const path of ["/auth", "/history", "/settings"]) assert.equal(cachedPaths.includes(path), false);
        } finally { await browser.close(); }
    });

    test(`${name}: account mismatch blocks upload; lost response retries one stable record`, {timeout: 120000}, async () => {
        const {browser, context, page} = await prepare(type);
        const ownerA = "11111111-1111-4111-8111-111111111111";
        const ownerB = "22222222-2222-4222-8222-222222222222";
        const id = "33333333-3333-4333-8333-333333333333";
        api.userId = ownerB;
        api.rows.clear(); api.inserts = 0; api.authRequests = 0;
        try {
            async function signInAs(userId) {
                api.userId = userId;
                const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({sub: userId, exp: Math.floor(Date.now() / 1000) + 3600})).toString('base64url') + '.test';
                const session = {access_token: token, refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: mockUser()};
                const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
                await context.addCookies([{name: 'sb-' + project + '-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), url: origin}]);
            }
            await signInAs(ownerB);
            await page.evaluate(({id, ownerA}) => {
                const point = {lat: 37.5665, lng: 126.978};
                sessionStorage.setItem("runResult", JSON.stringify({id, ownerId: ownerA, startPoint: point, endPoint: point, distance_km: 0.1, duration_seconds: 60, pace: 600, activity_type: "running", pathPoints: [point]}));
            }, {id, ownerA});
            await page.goto(`${origin}/result`);
            await page.getByText("기기에 저장됨 · 같은 계정 연결 시 자동 업로드").waitFor();
            await page.evaluate(() => window.dispatchEvent(new Event("online")));
            await new Promise((resolve) => setTimeout(resolve, 600));
            assert.equal(api.inserts, 0);
            assert.ok(api.authRequests > 0);
            await signInAs(ownerA);
            await page.goto(origin + '/local-history');
            await page.waitForFunction(() => {
                const queue = JSON.parse(localStorage.getItem('pendingRunRecords'));
                return queue?.length === 0 || queue?.[0]?.retryCount > 0;
            });
            // Make the scheduled retry eligible without waiting for a timer.
            await page.evaluate(() => {
                const queue = JSON.parse(localStorage.getItem("pendingRunRecords"));
                if (queue.length === 0) return; // Some browsers retry the lost HTTP response themselves.
                queue[0].nextRetryAt = 0;
                localStorage.setItem("pendingRunRecords", JSON.stringify(queue));
                window.dispatchEvent(new Event("online"));
            });
            await page.waitForFunction(() => JSON.parse(localStorage.getItem("pendingRunRecords"))?.length === 0);
            assert.equal(api.rows.size, 1);
            assert.equal(api.inserts, 2);
            assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("rr_local_results"))[0].uploaded), true);
        } finally { await browser.close(); }
    });
}
