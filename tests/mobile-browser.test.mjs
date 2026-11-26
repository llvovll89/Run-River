import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdir} from "node:fs/promises";
import path from "node:path";
import {chromium, webkit} from "playwright";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), false);
const browserType = process.env.TEST_BROWSER === "webkit" ? webkit : chromium;

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
        browser = await browserType.launch({args: ["--enable-unsafe-swiftshader"]});
        const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce", permissions: ["geolocation"], geolocation: {latitude: 37.5665, longitude: 126.978, accuracy: 5}});
        await context.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on("pageerror", error => errors.push(`${new URL(page.url()).pathname}: ${error.message}`));
        await page.goto(origin, {waitUntil: "networkidle"});
        await page.getByTestId("offline-setup").filter({hasText: "앱 화면은 기기에 저장돼요"}).waitFor();
        assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
        await mkdir("output/playwright", {recursive: true});
        // Menu navigation must work in exported HTML without an RSC server.
        // Return from login and repeat: no backdrop may trap the next tap.
        for (const width of [320, 390]) {
            await page.setViewportSize({width, height: width === 320 ? 568 : 844});
            for (const colorScheme of ["light", "dark"]) {
                await page.emulateMedia({colorScheme});
                await page.goto(origin);
                const toggle = page.locator('[aria-controls="home-goal-options"]');
                assert.equal(await toggle.getAttribute("aria-expanded"), "false");
                assert.ok(await toggle.evaluate(el => el.getBoundingClientRect().top > innerHeight * (innerHeight < 650 ? .5 : .6)));
                await toggle.click();
                await page.getByRole("button", {name: "3km", exact: true}).click();
                await toggle.click();
                assert.equal(await page.getByRole("button", {name: "3km", exact: true}).isVisible(), false);
                assert.ok(await page.getByRole("button", {name: /3km.*시작/}).isVisible());
                await page.screenshot({path: `output/playwright/home-compact-${width}-${colorScheme}.png`});
                // Guests get an explanation before the login screen, from 더보기 and from the tab bar.
                await page.getByRole("button", {name: "더보기", exact: true}).click();
                await page.getByRole("button", {name: "기록", exact: true}).click();
                const loginSheet = page.getByRole("dialog", {name: "기록 화면은 로그인이 필요해요"});
                await loginSheet.waitFor();
                await loginSheet.getByRole("link", {name: "로그인하기", exact: true}).click();
                await page.waitForURL(/\/auth\/?\?next=%2Fhistory/);
                await page.getByRole("note").filter({hasText: "통계와 계정 기록은 로그인 후"}).waitFor();
                await page.getByRole("button", {name: "뒤로가기", exact: true}).click();
                await page.waitForURL(origin + "/");
                await page.getByRole("button", {name: "더보기", exact: true}).click();
                await page.getByRole("button", {name: "설정", exact: true}).click();
                const settingsSheet = page.getByRole("dialog", {name: "설정 화면은 로그인이 필요해요"});
                await settingsSheet.getByRole("button", {name: "나중에", exact: true}).click();
                assert.equal(await settingsSheet.count(), 0);
                assert.equal(new URL(page.url()).pathname, "/");
                await page.getByRole("navigation", {name: "주요 메뉴"}).getByRole("link", {name: "통계", exact: true}).click();
                const statsSheet = page.getByRole("dialog", {name: "통계 화면은 로그인이 필요해요"});
                await statsSheet.waitFor();
                await page.keyboard.press("Escape");
                assert.equal(await statsSheet.count(), 0);
                await page.getByRole("navigation", {name: "주요 메뉴"}).getByRole("link", {name: "통계", exact: true}).click();
                await statsSheet.getByRole("link", {name: "로그인하기", exact: true}).click();
                await page.waitForURL(/\/auth\/?\?next=%2Fhistory/);
                await page.getByRole("button", {name: "뒤로가기", exact: true}).click();
                await page.waitForURL(origin + "/");
                await page.getByRole("button", {name: "장소 검색", exact: true}).click();
                await page.keyboard.press("Escape");
                await page.locator('[aria-controls="home-goal-options"]').click();
            }
        }
        await page.evaluate(() => sessionStorage.setItem("runConfig", JSON.stringify({startPoint: {lat: 37.5665, lng: 126.978}, endPoint: null, activityType: "walking", goalDistance: 3, goalTime: null})));
        await page.goto(origin + "/running/", {waitUntil: "networkidle"});
        await page.getByText("일시정지", {exact: true}).first().waitFor();
        await page.goto(origin + "/local-history/", {waitUntil: "networkidle"});
        await page.getByRole("heading", {name: "기기 기록", exact: true}).waitFor();
        await mkdir("output/playwright", {recursive: true});
        await page.screenshot({path: "output/playwright/mobile-bundle.png"});
        assert.deepEqual(errors, []);
        // A stalled auth service must not remove navigation or leave an endless
        // loading screen. Only fabricated credentials enter this isolated context.
        const slowContext = await browser.newContext({viewport: {width: 390, height: 844}});
        await slowContext.route("**/*", route => {
            if (route.request().url().startsWith(origin + "/")) return route.continue();
            if (new URL(route.request().url()).pathname === "/auth/v1/user") return;
            return route.abort();
        });
        const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
        await slowContext.addInitScript(({storageKey}) => {
            const user = {id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "slow@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z"};
            const expires_at = Math.floor(Date.now() / 1000) + 3600;
            const token = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({sub: user.id, exp: expires_at}))}.test`;
            localStorage.setItem(storageKey, JSON.stringify({access_token: token, refresh_token: "test", token_type: "bearer", expires_at, expires_in: 3600, user}));
        }, {storageKey});
        const slowPage = await slowContext.newPage();
        const authStarted = slowPage.waitForRequest(request => new URL(request.url()).pathname === "/auth/v1/user");
        await slowPage.goto(origin + "/history/");
        await authStarted;
        await slowPage.getByRole("status").filter({hasText: "기록을 불러오는 중"}).waitFor();
        assert.ok(await slowPage.getByRole("navigation", {name: "주요 메뉴"}).getByRole("link", {name: "설정", exact: true}).isVisible());
        try {
            await slowPage.getByText("연결이 지연되고 있어요. 인터넷 연결을 확인한 뒤 통계를 다시 열어주세요.", {exact: true}).waitFor({timeout: 15000});
        } catch (error) {
            throw new Error(`Stalled auth did not reach its recovery state: ${await slowPage.locator("body").innerText()}`, {cause: error});
        }
        await slowPage.getByRole("navigation", {name: "주요 메뉴"}).getByRole("link", {name: "운동", exact: true}).click();
        await slowPage.waitForURL(origin + "/");
        await slowPage.locator('[aria-controls="home-goal-options"]').click();
        await slowContext.close();
        // A slow page load must still acknowledge the tap. The document request is cancelled
        // after React handles the click (window bubble phase), so the page stays put like a stalled load.
        const stalledNavContext = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce"});
        await stalledNavContext.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
        const stalledNavPage = await stalledNavContext.newPage();
        await stalledNavPage.clock.install();
        await stalledNavPage.goto(origin + "/local-history/", {waitUntil: "networkidle"});
        await stalledNavPage.evaluate(() => {
            window.__stallHome = true;
            window.addEventListener("click", event => {
                if (window.__stallHome && event.target instanceof Element && event.target.closest('nav a[href="/"]')) event.preventDefault();
            });
        });
        const mainNav = stalledNavPage.getByRole("navigation", {name: "주요 메뉴"});
        assert.equal(await mainNav.getByRole("link", {name: "기기 기록", exact: true}).getAttribute("aria-current"), "page");
        await mainNav.getByRole("link", {name: "운동", exact: true}).click();
        const busyTab = mainNav.locator('a[aria-busy="true"]');
        await busyTab.filter({hasText: "여는 중"}).waitFor({timeout: 2000});
        assert.equal(await busyTab.getAttribute("aria-label"), "운동");
        assert.equal(await stalledNavPage.locator(".navigation-notice").count(), 0);
        await stalledNavPage.clock.runFor(12500);
        await stalledNavPage.getByRole("status").filter({hasText: "운동 화면 연결이 느려요"}).waitFor();
        await stalledNavPage.evaluate(() => { window.__stallHome = false; });
        await mainNav.getByRole("link", {name: "운동", exact: true}).click();
        await stalledNavPage.waitForURL(origin + "/");
        await stalledNavContext.close();
        const nativeContext = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce"});
        await nativeContext.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
        await nativeContext.addInitScript((platform) => {
            if (platform === "ios") window.webkit = {messageHandlers: {bridge: {postMessage() {}}}};
            else window.androidBridge = {};
            window.Capacitor = {
                PluginHeaders: [{name: "NativeRun", methods: ["start", "snapshot", "pause", "resume", "finish", "acknowledge", "saveGpx"].map(name => ({name, rtype: "promise"}))}],
                nativePromise: async (plugin, method, options) => {
                    const read = () => JSON.parse(localStorage.getItem("mock-native-run") || "null");
                    let run = read();
                    if (method === "saveGpx") { localStorage.setItem("mock-gpx-export", options.gpx); return {}; }
                    if (method === "start") {
                        options.config.courseOverlay = {type: "FeatureCollection", features: [{type: "Feature", properties: {name: "기기 장소"}, geometry: {type: "Point", coordinates: [127, 37.6]}}]};
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
                sessionStorage.setItem("runConfig", JSON.stringify({runId: "native-test-1", ownerId: "owner-native-test", startPoint: {lat: 37.6, lng: 127}, endPoint: null, activityType: "hiking", goalDistance: null, goalTime: null}));
            }
        });
        const nativePage = await nativeContext.newPage();
        nativePage.setDefaultTimeout(15000);
        nativePage.on("pageerror", error => errors.push(error.message));
        await nativePage.goto(origin + "/running/", {waitUntil: "networkidle"});
        await nativePage.locator('[data-testid="offline-trail-map"][data-map-ready="true"]').waitFor();
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
        await nativePage.getByText("하이킹 기록은 이 기기에 저장했어요. 계정 업로드는 아직 지원하지 않아요.", {exact: true}).waitFor();
        assert.equal(await nativePage.evaluate(() => JSON.parse(localStorage.getItem("rr_local_results"))[0].result.activity_type), "hiking");
        assert.equal(await nativePage.evaluate(() => JSON.parse(localStorage.getItem("pendingRunRecords") || "[]").length), 0);
        await nativePage.getByRole("button", {name: "이동 경로 GPX 내보내기", exact: true}).click();
        await nativePage.waitForFunction(() => Boolean(localStorage.getItem("mock-gpx-export")));
        assert.ok((await nativePage.evaluate(() => localStorage.getItem("mock-gpx-export"))).includes('<trkpt lat="37.6" lon="127">'));
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
