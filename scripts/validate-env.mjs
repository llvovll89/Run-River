import fs from "node:fs";
import path from "node:path";

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_KAKAO_MAP_KEY",
];

const OPTIONAL_KEYS = ["NEXT_PUBLIC_TMAP_KEY"];

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const root = process.cwd();
loadDotEnvFile(path.join(root, ".env.local"));

const missingRequired = REQUIRED_KEYS.filter((key) => !process.env[key]?.trim());

if (missingRequired.length > 0) {
  console.error("[env] Missing required environment variables:");
  for (const key of missingRequired) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log("[env] Required environment variables are set.");

const missingOptional = OPTIONAL_KEYS.filter((key) => !process.env[key]?.trim());
if (missingOptional.length > 0) {
  console.warn("[env] Optional variables not set:");
  for (const key of missingOptional) {
    console.warn(`- ${key}`);
  }
  console.warn("[env] Continuing because these keys are optional.");
}
