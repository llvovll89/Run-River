import {cp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import nextEnv from "@next/env";

const root = fileURLToPath(new URL("../", import.meta.url));
const stage = path.resolve(root, ".mobile-build");
const output = path.resolve(root, "mobile-dist");

// Only these fixed, generated workspace directories may ever be removed.
for (const target of [stage, output]) {
    if (path.dirname(target) !== path.resolve(root)) throw new Error("Unsafe build directory");
    await rm(target, {recursive: true, force: true});
}

// Read environment in the actual project directory; never copy .env into the APK.
nextEnv.loadEnvConfig(root, false);
await mkdir(stage, {recursive: true});
await cp(path.join(root, "src"), path.join(stage, "src"), {recursive: true});
await cp(path.join(root, "public"), path.join(stage, "public"), {
    recursive: true,
    filter: (source) => !/^(sw|workbox-.*|worker-.*)\.js$/.test(path.basename(source)),
});
await cp(path.join(root, "mobile/next.config.mjs"), path.join(stage, "next.config.mjs"));
await cp(path.join(root, "package.json"), path.join(stage, "package.json"));
const tsconfig = JSON.parse(await readFile(path.join(root, "tsconfig.json"), "utf8"));
tsconfig.exclude = ["node_modules"];
await writeFile(path.join(stage, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
await cp(path.join(root, "postcss.config.js"), path.join(stage, "postcss.config.js"));

// The web app keeps its server routes. Replace them only in this generated build.
await rm(path.join(stage, "src/middleware.ts"));
await cp(path.join(stage, "src/app/running/page.tsx"), path.join(stage, "src/components/WebRunningPage.tsx"));
await rm(path.join(stage, "src/app/auth/callback"), {recursive: true});
await mkdir(path.join(stage, "src/app/auth/callback"), {recursive: true});
for (const [source, destination] of [
    ["home.tsx", "page.tsx"],
    ["history.tsx", "history/page.tsx"],
    ["running.tsx", "running/page.tsx"],
    ["auth-callback.tsx", "auth/callback/page.tsx"],
]) {
    await cp(path.join(root, "mobile/pages", source), path.join(stage, "src/app", destination));
}

const result = spawnSync(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build", stage], {
    cwd: root,
    stdio: "inherit",
    env: {...process.env, NEXT_PUBLIC_NATIVE_APP: "1", NEXT_DISABLE_PWA: "1"},
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Fail instead of producing a partial app when a required route stops exporting.
for (const route of ["index.html", "running/index.html", "result/index.html", "history/index.html", "settings/index.html", "auth/index.html", "local-history/index.html"]) {
    await readFile(path.join(stage, "out", route));
}
await cp(path.join(stage, "out"), output, {recursive: true});
console.log("[mobile] Static UI exported to mobile-dist. No remote server URL is used.");
