// Run River symbol: one GPS route that draws an italic R, starting from an orange start point.
// 100-unit grid. Keep in sync with src/components/Brand.tsx and docs/brand/generate_brand.py.
export const NAVY = "#16294A";
export const ORANGE = "#F25C1F";
const ROUTE = "M30 80 V33 A13 13 0 0 1 43 20 H55 A17 17 0 0 1 55 54 H50 L74 84";

function symbol(scale) {
    // The symbol is optically centred at (50, 49.5); shrink it about that point.
    const s = scale * 0.8;
    const route = `translate(${50 + (53.5 - 50) * scale} ${49.5 + (49.2 - 49.5) * scale}) scale(${s}) skewX(-8) translate(-52 -52)`;
    const dot = {x: 50 + (32.75 - 50) * scale, y: 49.5 + (71.6 - 49.5) * scale, r: 8.8 * scale};
    return `<path transform="${route}" d="${ROUTE}" fill="none" stroke="#FFFFFF" stroke-width="12.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${dot.x}" cy="${dot.y}" r="${dot.r}" fill="${ORANGE}"/>`;
}

/**
 * @param {number} size output pixels
 * @param {{shape?: "rounded"|"square"|"circle"|"none", scale?: number}} options
 *   rounded: PWA "any" icon and favicon; square: full-bleed for iOS/maskable;
 *   circle: Android legacy round icon; none: transparent (adaptive foreground).
 */
export function iconSvg(size, {shape = "rounded", scale = 1} = {}) {
    const background = {
        rounded: `<rect width="100" height="100" rx="22.4" fill="${NAVY}"/>`,
        square: `<rect width="100" height="100" fill="${NAVY}"/>`,
        circle: `<circle cx="50" cy="50" r="50" fill="${NAVY}"/>`,
        none: "",
    }[shape];
    return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${background}${symbol(scale)}</svg>`);
}
