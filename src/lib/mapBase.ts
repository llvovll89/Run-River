import type {LatLng} from "@/types";

/**
 * Online base map: OpenFreeMap (free, no key, OpenMapTiles schema over OpenStreetMap data).
 * Offline base map: the user's saved PMTiles pack. Kakao is used only for place search.
 */
// "fiord" is OpenFreeMap's blue-grey dark style; it matches the app's navy dark theme and keeps labels legible.
export const OPENFREEMAP_STYLE = {light: "https://tiles.openfreemap.org/styles/liberty", dark: "https://tiles.openfreemap.org/styles/fiord"} as const;
export const OPENFREEMAP_TILEJSON = "https://tiles.openfreemap.org/planet";
/** Font available from OpenFreeMap's glyph server, for our own symbol layers on the online style. */
export const OPENFREEMAP_FONT = "Noto Sans Regular";
export const OSM_ATTRIBUTION = "© OpenStreetMap · OpenMapTiles · OpenFreeMap";
/** Mapzen/AWS open terrain tiles (terrarium encoding) for hill shading. */
export const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const MAP_COLORS = {
    accent: "#2f4766",
    walk: "#627c50",
    course: "#276e9a",
    preview: "#8e8e93",
    arrival: "#ff9f0a",
} as const;

let tileTemplate: Promise<string> | null = null;
/** The versioned vector tile URL template from OpenFreeMap's TileJSON (cached per session). */
export function openFreeMapTileTemplate(): Promise<string> {
    tileTemplate ??= fetch(OPENFREEMAP_TILEJSON, {credentials: "omit"})
        .then(response => { if (!response.ok) throw new Error(`TileJSON ${response.status}`); return response.json(); })
        .then((json: {tiles?: string[]}) => { if (!json.tiles?.[0]) throw new Error("TileJSON without tiles"); return json.tiles[0]; })
        .catch(error => { tileTemplate = null; throw error; });
    return tileTemplate;
}

/** Polygon approximating a circle of `radiusM` meters, as [lng, lat] ring for GeoJSON. */
export function circleRing(center: LatLng, radiusM: number, steps = 48): [number, number][] {
    const metersPerDegLat = 111_320;
    const metersPerDegLng = metersPerDegLat * Math.max(0.01, Math.cos(center.lat * Math.PI / 180));
    const ring: [number, number][] = [];
    for (let i = 0; i <= steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2;
        ring.push([center.lng + (Math.sin(angle) * radiusM) / metersPerDegLng, center.lat + (Math.cos(angle) * radiusM) / metersPerDegLat]);
    }
    return ring;
}

const MAP_PREFS_KEY = "rr_map_prefs";
export interface MapPrefs { terrain: boolean }
export function readMapPrefs(): MapPrefs {
    try { return {terrain: JSON.parse(localStorage.getItem(MAP_PREFS_KEY) ?? "{}").terrain === true}; }
    catch { return {terrain: false}; }
}
export function writeMapPrefs(prefs: MapPrefs) {
    try { localStorage.setItem(MAP_PREFS_KEY, JSON.stringify(prefs)); } catch { /* preference only */ }
}

/** True on iPhone/iPad (native shell or Safari), where WKWebView's WebGL surface is unreliable. */
export function prefersCanvasMap(isNativeIos: boolean): boolean {
    if (isNativeIos) return true;
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
