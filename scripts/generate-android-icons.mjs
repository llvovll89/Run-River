import sharp from "sharp";
import {readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {iconSvg} from "./brand-icon.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const res = path.join(root, "android/app/src/main/res");
const icon = path.join(root, "public/icons/icon-512x512.png");
for (const [density, size] of Object.entries({mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192})) {
    const directory = path.join(res, `mipmap-${density}`);
    await sharp(iconSvg(size)).png().toFile(path.join(directory, "ic_launcher.png"));
    await sharp(iconSvg(size, {shape: "circle", scale: .8})).png().toFile(path.join(directory, "ic_launcher_round.png"));
    // Adaptive icon: 108dp canvas, launcher masks keep a 66dp circle, so the mark stays inside ~61%.
    // The navy background comes from values/ic_launcher_background.xml.
    const canvas = Math.round(size * 2.25);
    await sharp(iconSvg(canvas, {shape: "none", scale: .66})).png().toFile(path.join(directory, "ic_launcher_foreground.png"));
}

for (const directory of await readdir(res)) {
    if (!directory.startsWith("drawable")) continue;
    const splash = path.join(res, directory, "splash.png");
    let metadata;
    try { metadata = await sharp(splash).metadata(); } catch { continue; }
    const {width, height} = metadata;
    if (!width || !height) throw new Error("Invalid splash dimensions");
    const size = Math.round(Math.min(width, height) * 0.24);
    const content = await sharp(icon).resize(size, size).png().toBuffer();
    // Render from the source icon, never from Capacitor's template graphic.
    await sharp({create: {width, height, channels: 4, background: "#ffffff"}})
        .composite([{input: content, gravity: "centre"}]).png().toFile(splash);
}
