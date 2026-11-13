import {spawnSync} from "node:child_process";

// Use a local mocked API so browser tests cannot touch production accounts/data.
const env = {...process.env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3137", NEXT_PUBLIC_SUPABASE_ANON_KEY: "offline-test-placeholder", NEXT_PUBLIC_KAKAO_MAP_KEY: "offline-test-placeholder"};
for (const args of [
    ["node_modules/next/dist/bin/next", "build"],
    ["scripts/generate-service-worker.mjs"],
    ["--test", "tests/offline-browser.test.mjs"],
]) {
    const result = spawnSync(process.execPath, args, {env, stdio: "inherit"});
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
