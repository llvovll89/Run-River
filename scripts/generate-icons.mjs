import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/icons");

function makeSvg(size) {
  const r  = size * 0.22;
  const sw = size * 0.055; // stroke width

  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#1a6fff"/>
      <stop offset="100%" stop-color="#3730d4"/>
    </linearGradient>
    <clipPath id="clip">
      <rect width="100" height="100" rx="${r * 100 / size}" ry="${r * 100 / size}"/>
    </clipPath>
  </defs>

  <!-- 배경 -->
  <rect width="100" height="100" rx="${r * 100 / size}" ry="${r * 100 / size}" fill="url(#bg)"/>

  <!-- 웨이브 (하단) -->
  <g clip-path="url(#clip)">
    <path d="M-5 78 Q10 70 25 78 Q40 86 55 78 Q70 70 85 78 Q100 86 110 78 L110 105 L-5 105 Z"
      fill="white" opacity="0.12"/>
    <path d="M-5 86 Q8 80 20 86 Q32 92 44 86 Q56 80 68 86 Q80 92 92 86 Q104 80 110 86 L110 105 L-5 105 Z"
      fill="white" opacity="0.18"/>
  </g>

  <!-- 달리는 사람 (stroke 기반) -->
  <g stroke="white" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-width="${sw * 100 / size}">
    <!-- 머리 -->
    <circle cx="60" cy="18" r="8" fill="white" stroke="none"/>
    <!-- 몸통 (앞으로 기울어짐) -->
    <line x1="57" y1="26" x2="44" y2="48"/>
    <!-- 뒷 팔 (위로 힘차게) -->
    <path d="M 54 33 Q 44 26 36 18" stroke-width="${sw * 100 / size}"/>
    <!-- 앞 팔 (뒤로) -->
    <path d="M 52 36 Q 62 40 70 48" stroke-width="${sw * 100 / size}"/>
    <!-- 앞 다리 (앞으로 뻗음) -->
    <path d="M 44 48 Q 36 58 28 63"/>
    <!-- 앞 발 -->
    <path d="M 28 63 Q 22 66 16 64"/>
    <!-- 뒷 다리 (뒤로 차올림) -->
    <path d="M 44 48 Q 50 58 56 62"/>
    <!-- 뒷 다리 상단 무릎) -->
    <path d="M 56 62 Q 64 56 68 48"/>
  </g>

  <!-- 속도선 -->
  <g stroke="white" stroke-linecap="round" opacity="0.45">
    <line x1="8"  y1="40" x2="22" y2="40" stroke-width="${sw * 0.7 * 100 / size}"/>
    <line x1="6"  y1="50" x2="18" y2="50" stroke-width="${sw * 0.55 * 100 / size}"/>
    <line x1="10" y1="60" x2="20" y2="60" stroke-width="${sw * 0.45 * 100 / size}"/>
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

console.log("완료!");
