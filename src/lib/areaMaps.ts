import {zxyToTileId} from "pmtiles";

/**
 * "Save the area on screen" maps: OpenFreeMap vector tiles (OpenMapTiles schema) for a bounding
 * box, packed into a PMTiles v3 archive on the device so the existing offline-map code reads it.
 */
export type Bounds = [west: number, south: number, east: number, north: number];
export interface AreaTile {z: number; x: number; y: number; data: Uint8Array}

export const AREA_MIN_ZOOM = 8;
/** OpenMapTiles' last zoom: deeper views overzoom these tiles. */
export const AREA_MAX_ZOOM = 14;
/** Roughly a 35 km square around Seoul: keeps downloads polite to the free tile server. */
export const AREA_MAX_TILES = 1200;
/** Compressed bytes per tile measured over central Seoul (2026-11). Mountains are far smaller (z14 ≈ 4 KB),
 *  so estimates from these are an upper bound. */
const CITY_TILE_BYTES: Record<number, number> = {8: 190_000, 9: 230_000, 10: 140_000, 11: 85_000, 12: 90_000, 13: 60_000, 14: 160_000};
const MAX_LAT = 85.0511;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lngToX = (lng: number, z: number) => clamp(Math.floor((lng + 180) / 360 * 2 ** z), 0, 2 ** z - 1);
function latToY(lat: number, z: number) {
    const r = clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI / 180;
    return clamp(Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z), 0, 2 ** z - 1);
}
const xToLng = (x: number, z: number) => x / 2 ** z * 360 - 180;
const yToLat = (y: number, z: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI;

function range(bounds: Bounds, z: number) {
    const [west, south, east, north] = bounds;
    return {x0: lngToX(west, z), x1: lngToX(east, z), y0: latToY(north, z), y1: latToY(south, z)};
}

export function countAreaTiles(bounds: Bounds, minZoom = AREA_MIN_ZOOM, maxZoom = AREA_MAX_ZOOM) {
    let count = 0;
    for (let z = minZoom; z <= maxZoom; z++) { const r = range(bounds, z); count += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1); }
    return count;
}
/** Upper-bound download size for `bounds` (city density everywhere). */
export function estimateAreaBytes(bounds: Bounds, minZoom = AREA_MIN_ZOOM, maxZoom = AREA_MAX_ZOOM) {
    let bytes = 0;
    for (let z = minZoom; z <= maxZoom; z++) { const r = range(bounds, z); bytes += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) * (CITY_TILE_BYTES[z] ?? 100_000); }
    return bytes;
}

export function areaTiles(bounds: Bounds, minZoom = AREA_MIN_ZOOM, maxZoom = AREA_MAX_ZOOM) {
    const tiles: {z: number; x: number; y: number}[] = [];
    for (let z = minZoom; z <= maxZoom; z++) {
        const r = range(bounds, z);
        for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) tiles.push({z, x, y});
    }
    return tiles;
}

/** The ground the deepest saved tiles actually cover (a little more than the requested box). */
export function coveredBounds(bounds: Bounds, z = AREA_MAX_ZOOM): Bounds {
    const r = range(bounds, z);
    return [xToLng(r.x0, z), yToLat(r.y1 + 1, z), xToLng(r.x1 + 1, z), yToLat(r.y0, z)];
}

function writeVarint(out: number[], value: number) {
    while (value >= 0x80) { out.push((value % 0x80) | 0x80); value = Math.floor(value / 0x80); }
    out.push(value);
}
interface Entry {tileId: number; offset: number; length: number; runLength: number}
function serializeDirectory(entries: Entry[]) {
    const out: number[] = [];
    writeVarint(out, entries.length);
    let last = 0;
    for (const entry of entries) { writeVarint(out, entry.tileId - last); last = entry.tileId; }
    for (const entry of entries) writeVarint(out, entry.runLength);
    for (const entry of entries) writeVarint(out, entry.length);
    entries.forEach((entry, i) => {
        const previous = entries[i - 1];
        writeVarint(out, previous && entry.offset === previous.offset + previous.length ? 0 : entry.offset + 1);
    });
    return Uint8Array.from(out);
}
function setUint64(view: DataView, offset: number, value: number) {
    view.setUint32(offset, value % 2 ** 32, true);
    view.setUint32(offset + 4, Math.floor(value / 2 ** 32), true);
}

const HEADER_BYTES = 127;
/** Readers fetch the first 16 KiB for the header and root directory. */
const ROOT_LIMIT = 16_384;

/** Writes a clustered PMTiles v3 archive of vector tiles (tile bytes already compressed as `tileCompression`). */
export function buildPmtiles(tiles: AreaTile[], options: {bounds: Bounds; minZoom: number; maxZoom: number; metadata: object; tileCompression: "gzip" | "none"}) {
    const sorted = tiles.map(tile => ({tile, tileId: zxyToTileId(tile.z, tile.x, tile.y)})).sort((a, b) => a.tileId - b.tileId);
    const entries: Entry[] = [];
    let offset = 0;
    for (const {tile, tileId} of sorted) {
        if (entries.at(-1)?.tileId === tileId) continue;
        entries.push({tileId, offset, length: tile.data.byteLength, runLength: 1});
        offset += tile.data.byteLength;
    }
    if (entries.length === 0) throw new Error("저장할 지도 데이터가 없어요.");
    let root = serializeDirectory(entries);
    let leaf = new Uint8Array(0);
    if (HEADER_BYTES + root.byteLength > ROOT_LIMIT) {
        leaf = root;
        root = serializeDirectory([{tileId: entries[0].tileId, offset: 0, length: leaf.byteLength, runLength: 0}]);
    }
    const metadata = new TextEncoder().encode(JSON.stringify(options.metadata));
    const rootOffset = HEADER_BYTES, metadataOffset = rootOffset + root.byteLength, leafOffset = metadataOffset + metadata.byteLength, dataOffset = leafOffset + leaf.byteLength;
    const archive = new Uint8Array(dataOffset + offset);
    const view = new DataView(archive.buffer);
    archive.set(new TextEncoder().encode("PMTiles"), 0);
    view.setUint8(7, 3);
    setUint64(view, 8, rootOffset); setUint64(view, 16, root.byteLength);
    setUint64(view, 24, metadataOffset); setUint64(view, 32, metadata.byteLength);
    setUint64(view, 40, leafOffset); setUint64(view, 48, leaf.byteLength);
    setUint64(view, 56, dataOffset); setUint64(view, 64, offset);
    setUint64(view, 72, entries.length); setUint64(view, 80, entries.length); setUint64(view, 88, entries.length);
    view.setUint8(96, 1); // clustered
    view.setUint8(97, 1); // directories and metadata uncompressed
    view.setUint8(98, options.tileCompression === "gzip" ? 2 : 1);
    view.setUint8(99, 1); // MVT
    view.setUint8(100, options.minZoom); view.setUint8(101, options.maxZoom);
    const [west, south, east, north] = options.bounds;
    view.setInt32(102, Math.round(west * 1e7), true); view.setInt32(106, Math.round(south * 1e7), true);
    view.setInt32(110, Math.round(east * 1e7), true); view.setInt32(114, Math.round(north * 1e7), true);
    view.setUint8(118, Math.min(options.maxZoom, 13));
    view.setInt32(119, Math.round((west + east) / 2 * 1e7), true); view.setInt32(123, Math.round((south + north) / 2 * 1e7), true);
    archive.set(root, rootOffset); archive.set(metadata, metadataOffset); archive.set(leaf, leafOffset);
    let cursor = dataOffset;
    let previous = -1;
    for (const {tile, tileId} of sorted) {
        if (tileId === previous) continue;
        archive.set(tile.data, cursor); cursor += tile.data.byteLength; previous = tileId;
    }
    return archive;
}

/** Layers in OpenFreeMap's OpenMapTiles tiles; offline readers use this to pick drawing rules. */
export const OPENMAPTILES_LAYERS = ["water", "waterway", "landcover", "landuse", "mountain_peak", "park", "boundary", "aeroway", "transportation", "building", "water_name", "transportation_name", "place", "housenumber", "poi", "aerodrome_label"];
