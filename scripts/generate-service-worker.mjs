import {readFile, readdir, writeFile} from "node:fs/promises";

const buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
const files = await readdir(".next/static", {recursive: true});
const assets = files.filter((name) => /\.(js|css|woff2?)$/.test(name))
    .map((name) => `/_next/static/${name.replaceAll("\\", "/")}`);
assets.push("/manifest.json", "/icons/icon-192x192.png", "/icons/icon-512x512.png", "/icons/favicon-32.png");
assets.push("/fonts/NotoSans-Regular.ttf");
assets.push("/map-runtime/maplibre-gl-worker.mjs", "/map-runtime/maplibre-gl-shared.mjs");
const source = await readFile("worker/offline-worker.js", "utf8");
await writeFile("public/sw.js", `const VERSION = ${JSON.stringify(buildId)};\nconst ASSETS = ${JSON.stringify(assets)};\n${source}`);
console.log(`[offline] Generated service worker for ${assets.length} assets.`);
