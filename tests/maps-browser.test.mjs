import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdir} from "node:fs/promises";
import path from "node:path";
import {chromium} from "playwright";

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
        browser = await chromium.launch({args: ["--enable-webgl", "--enable-unsafe-swiftshader"]});
        const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: "reduce"});
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
        allowDownload = false;
        await page.reload({waitUntil: "networkidle"});
        await page.locator('[data-testid="offline-trail-map"][data-map-ready="true"]').waitFor();
        assert.equal(mapRequests, 1, "Stored map must not be fetched again");
        assert.ok(await page.locator(".maplibregl-map").evaluate(element => element.clientHeight >= 300), "The rendered map must have a visible viewport");
        await mkdir("output/playwright", {recursive: true});
        await page.getByTestId("offline-trail-map").screenshot({path: "output/playwright/offline-trail-map.png"});
        assert.deepEqual(await page.getByRole("alert").allTextContents(), [""]);
        await page.locator('input[type="file"]').setInputFiles({name: "broken.pmtiles", mimeType: "application/octet-stream", buffer: Buffer.from("broken")});
        await page.getByRole("alert").filter({hasText: /PMTiles|Magic|magic|header|offset|bounds|buffer|Range|range/}).first().waitFor();
        assert.equal(await page.getByTestId("offline-trail-map").count(), 1, "Invalid import must preserve the selected map");
        await page.getByRole("button", {name: "삭제", exact: true}).click();
        await page.getByRole("button", {name: "삭제 확인", exact: true}).click();
        await page.getByText("아직 저장한 지도가 없어요.", {exact: true}).waitFor();
        assert.equal(await page.getByTestId("offline-trail-map").count(), 0);
        assert.deepEqual(errors, []);
        // The page's shared font CSS may request the existing CDN, but all map/font data is local.
        assert.equal(externalRequests.filter(url => !url.includes("cdn.jsdelivr.net")).length, 0);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
