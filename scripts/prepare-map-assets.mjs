import {copyFile, mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const root = new URL("../", import.meta.url);
await mkdir(new URL("public/map-runtime/", root), {recursive: true});
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
    await copyFile(fileURLToPath(new URL(`node_modules/maplibre-gl/dist/${name}`, root)), fileURLToPath(new URL(`public/map-runtime/${name}`, root)));
}
