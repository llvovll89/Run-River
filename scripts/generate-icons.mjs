// Regenerates every web and iOS app icon from scripts/brand-icon.mjs.
// Android launcher icons: scripts/generate-android-icons.mjs.
import sharp from "sharp";
import {readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {iconSvg, NAVY} from "./brand-icon.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(root, "public/icons");

async function generate(path, size, options) {
    let image = sharp(iconSvg(size, options));
    // iOS rejects app icons with an alpha channel and applies its own mask.
    if (options?.shape === "square") image = image.flatten({background: NAVY});
    await image.png().toFile(path);
    console.log(`✓ ${path.replace(root, "")}`);
}

await generate(join(OUT, "icon-512x512.png"), 512);
await generate(join(OUT, "icon-192x192.png"), 192);
// Maskable: the whole mark must sit inside the 80% safe-zone circle.
await generate(join(OUT, "icon-maskable-512x512.png"), 512, {shape: "square", scale: .8});
await generate(join(OUT, "icon-maskable-192x192.png"), 192, {shape: "square", scale: .8});
await generate(join(OUT, "apple-touch-icon.png"), 180, {shape: "square", scale: .9});
await generate(join(OUT, "favicon-32.png"), 32);
await generate(join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"), 1024, {shape: "square", scale: .9});

const png = await readFile(join(OUT, "favicon-32.png"));
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 32; ico[7] = 32;
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
await writeFile(join(OUT, "favicon.ico"), Buffer.concat([ico, png]));
console.log("✓ public/icons/favicon.ico");
