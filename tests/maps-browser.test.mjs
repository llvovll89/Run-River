import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdir} from "node:fs/promises";
import path from "node:path";
import {chromium, webkit} from "playwright";
const browserType = process.env.TEST_BROWSER === "webkit" ? webkit : chromium;
import {kmzFixture, kmlFixture} from "./kmz-fixture.mjs";

test("downloaded trail map renders after network loss and survives reopening", {timeout: 90000}, async () => {
    const root = path.resolve("mobile-dist");
    let mapRequests = 0;
    let allowDownload = true;
    const server = createServer(async (req, res) => {
        try {
            const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
            let file;
            if (pathname === "/offline-maps/bukhansan.pmtiles") {
                mapRequests++;
                if (!allowDownload) { res.writeHead(503); res.end(); return; }
                file = path.resolve("public/offline-maps/bukhansan.pmtiles");
            } else {
                file = path.resolve(root, "." + pathname);
                if (!file.startsWith(root + path.sep) && file !== root) throw new Error("outside bundle");
                if (!path.extname(file)) file = path.join(file, "index.html");
            }
            const mime = {".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".ttf": "font/ttf"};
            res.writeHead(200, {"Content-Type": mime[path.extname(file)] || "application/octet-stream"});
            res.end(await readFile(file));
        } catch { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = await browserType.launch({args: ["--enable-webgl", "--enable-unsafe-swiftshader"]});
        const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce", ...(process.env.TEST_MAP_ENGINE === "canvas" ? {userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"} : {})});
        const externalRequests = [];
        await context.route("**/*", route => {
            const url = route.request().url();
            if (url.startsWith(origin + "/") || url.startsWith("blob:")) return route.continue();
            externalRequests.push(url); return route.abort();
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(origin + "/maps/", {waitUntil: "networkidle"});
        await page.getByRole("button", {name: "북한산 지도 저장", exact: true}).click();
        await page.locator('[data-testid="offline-trail-map"][data-map-ready="true"]').waitFor().catch(async error => {
            throw new Error(`${error.message}\n${await page.locator("body").innerText()}\n${errors.join("\n")}\nExternal: ${externalRequests.join(", ")}`);
        });
        assert.equal(mapRequests, 1);
        if (process.env.TEST_MAP_ENGINE === "canvas") {
            assert.equal(await page.getByTestId("offline-trail-map").getAttribute("data-map-engine"), "canvas");
            await page.waitForFunction(() => [...document.querySelectorAll("canvas.leaflet-tile")].some(canvas => {
                if (!canvas.width || !canvas.height) return false;
                const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
                const colors = new Set();
                for (let i = 0; i < data.length; i += 64) {
                    if (data[i+3]) colors.add((data[i]<<16) | (data[i+1]<<8) | data[i+2]);
                    if (colors.size > 4) return true;
                }
                return false;
            }));
        }
        allowDownload = false;
        await page.reload({waitUntil: "networkidle"});
        await page.locator('[data-testid="offline-trail-map"][data-map-ready="true"]').waitFor();
        assert.equal(mapRequests, 1, "Stored map must not be fetched again");
        assert.ok(await page.getByTestId("offline-trail-map").evaluate(element => element.clientHeight >= 300), "The rendered map must have a visible viewport");
        // The iOS UI test relies on this control to confirm the map opened.
        await page.getByRole("button", {name: "지도 확대", exact: true}).waitFor();
        await mkdir("output/playwright", {recursive: true});
        await page.getByTestId("offline-trail-map").screenshot({path: "output/playwright/offline-trail-map.png"});
        assert.deepEqual(await page.getByRole("alert").allTextContents(), [""]);
        await page.locator('input[type="file"]').setInputFiles({name: "broken.pmtiles", mimeType: "application/octet-stream", buffer: Buffer.from("broken")});
        await page.getByRole("alert").filter({hasText: /PMTiles|Magic|magic|header|offset|bounds|buffer|Range|range/}).first().waitFor();
        assert.equal(await page.getByTestId("offline-trail-map").count(), 1, "Invalid import must preserve the selected map");
        await page.getByRole("button", {name: "삭제", exact: true}).click();
        await page.getByRole("button", {name: "삭제 확인", exact: true}).click();
        await page.getByText("아직 저장한 지도가 없어요. 위에서 지역을 고르거나 북한산 지도로 먼저 확인해보세요.", {exact: true}).waitFor();
        assert.equal(await page.getByTestId("offline-trail-map").count(), 0);
        // Check the offline-map flow before opening the no-map hiking fallback.
        assert.equal(externalRequests.filter(url => !url.includes("cdn.jsdelivr.net")).length, 0);
        await page.goto(origin + "/hiking/", {waitUntil: "networkidle"});
        await page.getByLabel("코스 파일", {exact: true}).setInputFiles({name: "map.kmz", mimeType: "application/vnd.google-earth.kmz", buffer: Buffer.from(kmzFixture)});
        await page.getByText("경로 2개, 장소 1개, 구역 1개", {exact: true}).waitFor();
        await page.locator('[data-testid="offline-trail-map"][data-map-ready="true"]').waitFor();
        assert.equal(await page.getByLabel("따라갈 경로").inputValue(), "");
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("rr_hiking_course_v1")).points.length), 0);
        await page.getByLabel("따라갈 경로").selectOption("1");
        await page.reload({waitUntil: "networkidle"});
        await page.getByText("경로 2개, 장소 1개, 구역 1개", {exact: true}).waitFor();
        assert.equal(await page.getByLabel("따라갈 경로").inputValue(), "1");
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("rr_hiking_course_v1")).points[0].lat), 37.675);
        await page.locator('[data-testid="offline-trail-map"][data-map-ready="true"]').waitFor();
        await page.getByTestId("offline-trail-map").screenshot({path: "output/playwright/kmz-overlay.png"});
        assert.equal(externalRequests.some(url => url.includes("kmz-resource.invalid")), false);
        await page.getByLabel("코스 파일", {exact: true}).setInputFiles({name: "broken.kmz", mimeType: "application/vnd.google-earth.kmz", buffer: Buffer.from(kmzFixture.subarray(0, 20))});
        await page.getByText("KMZ 압축 파일이 손상되었어요.", {exact: true}).waitFor();
        await page.getByText("북한산 KMZ 표시", {exact: true}).waitFor();
        await page.getByLabel("코스 파일", {exact: true}).setInputFiles({name: "bad.kml", mimeType: "application/vnd.google-earth.kml+xml", buffer: Buffer.from(kmlFixture.replace("126.98,37.66,300", "126.98,999,300"))});
        await page.getByText("KML 좌표 범위를 확인해주세요.", {exact: true}).waitFor();
        await page.getByText("북한산 KMZ 표시", {exact: true}).waitFor();
        await page.getByLabel("코스 파일", {exact: true}).setInputFiles({name: "multi.kml", mimeType: "application/vnd.google-earth.kml+xml", buffer: Buffer.from('<k:kml xmlns:k="http://www.opengis.net/kml/2.2"><k:Folder><k:Placemark><k:name>멀티 표시</k:name><k:MultiGeometry><k:Point><k:coordinates>126.98,37.66</k:coordinates></k:Point><k:LineString><k:coordinates>126.98,37.66 126.99,37.67</k:coordinates></k:LineString></k:MultiGeometry></k:Placemark></k:Folder></k:kml>')});
        await page.getByText("경로 1개, 장소 1개, 구역 0개", {exact: true}).waitFor();
        assert.equal(await page.getByLabel("따라갈 경로").inputValue(), "0");
        await page.getByLabel("코스 파일").setInputFiles({name: "course.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from('<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>북한산 테스트 코스</name><trkseg><trkpt lat="37.66" lon="126.98"/><trkpt lat="37.661" lon="126.98"/></trkseg></trk></gpx>')});
        await page.getByText("북한산 테스트 코스", {exact: true}).waitFor();
        await page.getByLabel("코스 파일").setInputFiles({name: "invalid.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from('<!DOCTYPE gpx><gpx/>')});
        await page.getByText("외부 정의가 포함된 GPX는 사용할 수 없어요.", {exact: true}).waitFor();
        await page.getByText("북한산 테스트 코스", {exact: true}).waitFor();
        await context.grantPermissions(["geolocation"]);
        await context.setGeolocation({latitude: 37.66, longitude: 126.98, accuracy: 5});
        await page.getByRole("button", {name: "현재 위치에서 하이킹 시작", exact: true}).click();
        await page.waitForURL("**/running");
        await page.waitForFunction(() => JSON.parse(localStorage.getItem("rr_active_run") || "null")?.trackPoints?.length > 0);
        await page.getByRole("button", {name: "종료", exact: true}).click();
        await page.waitForURL("**/result?id=*");
        await page.getByText("하이킹 기록은 이 기기에 저장했어요. 계정 업로드는 아직 지원하지 않아요.", {exact: true}).waitFor();
        const downloadReady = page.waitForEvent("download");
        await page.getByRole("button", {name: "이동 경로 GPX 내보내기", exact: true}).click();
        const download = await downloadReady;
        assert.ok(download.suggestedFilename().endsWith(".gpx"));
        await download.saveAs("output/playwright/hiking-export.gpx");
        assert.ok((await readFile("output/playwright/hiking-export.gpx", "utf8")).includes('<trkpt lat="37.66" lon="126.98">'));
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("rr_local_results"))[0].result.activity_type), "hiking");
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});

test("an area picked on the map is saved from OpenFreeMap tiles and reopens offline", {timeout: 90000}, async () => {
    const root = path.resolve("mobile-dist");
    const server = createServer(async (req, res) => {
        try {
            let file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
            if (!file.startsWith(root)) throw new Error("outside bundle");
            if (!path.extname(file)) file = path.join(file, "index.html");
            const mime = {".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".ttf": "font/ttf"};
            res.writeHead(200, {"Content-Type": mime[path.extname(file)] || "application/octet-stream"});
            res.end(await readFile(file));
        } catch { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = await browserType.launch({args: ["--enable-webgl", "--enable-unsafe-swiftshader"]});
        const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce", permissions: ["geolocation"], geolocation: {latitude: 37.66, longitude: 126.98},
            ...(process.env.TEST_MAP_ENGINE === "canvas" ? {userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"} : {})});
        // A minimal valid vector tile (one empty "water" layer) stands in for OpenFreeMap.
        const tile = Buffer.from([0x1a, 0x09, 0x0a, 0x05, ...Buffer.from("water"), 0x78, 0x02]);
        let tileRequests = 0, online = true;
        await context.route("**/*", route => {
            const url = route.request().url();
            if (url.startsWith(origin + "/") || url.startsWith("blob:")) return route.continue();
            if (!online) return route.abort();
            if (url === "https://tiles.openfreemap.org/planet") return route.fulfill({json: {tiles: ["https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf"]}});
            if (url.startsWith("https://tiles.openfreemap.org/planet/test/")) { tileRequests++; return route.fulfill({body: tile, contentType: "application/vnd.mapbox-vector-tile"}); }
            return route.abort();
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        await page.goto(origin + "/maps/", {waitUntil: "networkidle"});
        await page.getByRole("button", {name: "지도에서 지역 고르기", exact: true}).click();
        await page.locator('[data-testid="area-picker-map"][data-map-ready="true"]').waitFor();
        await page.getByText(/^이 범위를 저장하면 최대/).waitFor();
        await page.getByText(/모바일 데이터를 최대/).waitFor();
        await page.getByRole("button", {name: "이 지역 저장", exact: true}).click();
        await page.getByText(/지도를 기기에 저장했어요\.$/).waitFor({timeout: 60000});
        assert.ok(tileRequests > 7, "every zoom from 8 to 14 is fetched");
        assert.equal(await page.getByTestId("area-picker-map").count(), 0, "the picker closes after saving");
        assert.match(await page.locator("section[aria-label='저장한 지도']").innerText(), /운동할 때 이 지도를 써요/);
        online = false;
        await page.reload({waitUntil: "networkidle"});
        await page.locator('[data-testid="offline-trail-map"][data-map-ready="true"]').waitFor();
        assert.equal(await page.getByTestId("offline-trail-map").getAttribute("data-map-base"), "pack");
        await page.getByRole("button", {name: "삭제", exact: true}).first().click();
        await page.getByRole("button", {name: "삭제 확인", exact: true}).click();
        await page.getByText("아직 저장한 지도가 없어요. 위에서 지역을 고르거나 북한산 지도로 먼저 확인해보세요.", {exact: true}).waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem("rr_area_maps")), "[]");
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
