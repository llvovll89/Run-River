import sharp from "sharp";
import {readFile, writeFile} from "node:fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/icons");

function makeSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#123d46"/>
    <g transform="translate(18 14) scale(2.2)" fill="none" stroke="#e4f2ef" stroke-linecap="round">
      <path d="M7 3c17 3-9 10 7 14s12 8 4 12" stroke-width="3"/>
      <path d="M16 3c17 3-9 10 7 14" stroke-width="1.5" opacity=".5"/>
    </g>
  </svg>`;
}

async function generate(size, filename) {
  const svg = Buffer.from(makeSvg(size));
  await sharp(svg).png().toFile(join(OUT, filename));
  console.log(`✓ ${filename}`);
}

await generate(512, "icon-512x512.png");
await generate(192, "icon-192x192.png");
await generate(180, "apple-touch-icon.png");
await generate(32,  "favicon-32.png");

const png = await readFile(join(OUT, "favicon-32.png"));
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 32; ico[7] = 32;
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
await writeFile(join(OUT, "favicon.ico"), Buffer.concat([ico, png]));

console.log("완료!");
