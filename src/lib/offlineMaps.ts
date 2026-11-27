import {Capacitor, registerPlugin} from "@capacitor/core";
import {PMTiles, FileSource, type Source, type RangeResponse} from "pmtiles";
import {AREA_MAX_TILES, AREA_MAX_ZOOM, AREA_MIN_ZOOM, OPENMAPTILES_LAYERS, areaTiles, buildPmtiles, coveredBounds, type AreaTile, type Bounds} from "./areaMaps";
import {openFreeMapTileTemplate} from "./mapBase";

export interface MapPack {
    id: string;
    name: string;
    size: number;
    bounds: [number, number, number, number];
    maxZoom: number;
    createdAt: number;
    /** Tile layers: Protomaps (bundled/imported files) or OpenMapTiles (areas saved from the online map). */
    schema?: "protomaps" | "openmaptiles";
}
// Keep reading older Blob records; ArrayBuffer also works in WebKit ports that
// cannot persist Blob/File values in IndexedDB (their transaction error can be null).
interface StoredMap extends MapPack {blob: Blob | ArrayBuffer}
const ACTIVE_KEY = "rr_offline_map";
/** Areas saved from the online map live in IndexedDB on every platform; their list stays in localStorage
 *  so listing never loads the map bytes. */
const AREA_INDEX_KEY = "rr_area_maps";
const isArea = (id: string) => id.startsWith("area-");
const MAX_BYTES = 200 * 1024 * 1024;
const SAMPLE_SHA256 = "0791c9747ec5eb2450541f01394feb37491050b88ff4415a1d4e7fd4de987189";
const NativeMaps = registerPlugin<{
    pick(): Promise<{id: string}>;
    download(options: {url: string; sha256: string}): Promise<{id: string}>;
    list(): Promise<{maps: {id: string; size: number}[]}>;
    read(options: {id: string; offset: number; length: number}): Promise<{base64: string}>;
    delete(options: {id: string}): Promise<void>;
    network(): Promise<{type: "wifi" | "cellular" | "none" | "unknown"}>;
}>("NativeMaps");
const native = () => ["android", "ios"].includes(Capacitor.getPlatform());

async function db() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("run-river-maps", 2);
        request.onupgradeneeded = () => {
            for (const name of ["maps", "areas"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, {keyPath: "id"});
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>, storeName: "maps" | "areas" = "maps"): Promise<T> {
    const database = await db();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = database.transaction(storeName, mode);
            const request = action(tx.objectStore(storeName));
            tx.oncomplete = () => resolve(request.result);
            tx.onabort = () => reject(tx.error ?? new Error("지도를 저장하지 못했어요. 기기 공간을 확인해주세요."));
            tx.onerror = () => reject(tx.error ?? request.error ?? new Error("지도 저장소 작업에 실패했어요. 기기 공간을 확인해주세요."));
        });
    } finally { database.close(); }
}

class DeviceSource implements Source {
    constructor(private id: string) {}
    getKey() { return `device-map-${this.id}`; }
    async getBytes(offset: number, length: number): Promise<RangeResponse> {
        const {base64} = await NativeMaps.read({id: this.id, offset, length});
        return {data: Uint8Array.from(atob(base64), char => char.charCodeAt(0)).buffer};
    }
}

async function describe(archive: PMTiles, id: string, name: string, size: number): Promise<MapPack> {
    const header = await archive.getHeader();
    const metadata = await archive.getMetadata() as {vector_layers?: {id: string}[]; name?: string};
    const schema = metadata.vector_layers?.some(layer => layer.id === "roads") ? "protomaps" : metadata.vector_layers?.some(layer => layer.id === "transportation") ? "openmaptiles" : null;
    if (header.specVersion !== 3 || header.tileType !== 1 || !schema) {
        throw new Error("Protomaps 형식의 PMTiles v3 벡터 지도를 사용해주세요.");
    }
    const bounds: MapPack["bounds"] = [header.minLon, header.minLat, header.maxLon, header.maxLat];
    if (bounds.some(value => !Number.isFinite(value)) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) throw new Error("지도 영역을 읽을 수 없어요.");
    return {id, name: name || metadata.name || "가져온 지도", size, bounds, maxZoom: header.maxZoom, createdAt: Date.now(), schema};
}

export function selectOfflineMap(id: string) {
    localStorage.setItem(ACTIVE_KEY, id);
    window.dispatchEvent(new Event("offline-map-changed"));
}
export function selectedOfflineMap() { return localStorage.getItem(ACTIVE_KEY); }

function areaIndex(): MapPack[] {
    try { const list = JSON.parse(localStorage.getItem(AREA_INDEX_KEY) ?? "[]"); return Array.isArray(list) ? list : []; }
    catch { return []; }
}
const writeAreaIndex = (list: MapPack[]) => localStorage.setItem(AREA_INDEX_KEY, JSON.stringify(list));

export async function listOfflineMaps(): Promise<MapPack[]> {
    return [...areaIndex(), ...await listFileMaps()];
}
async function listFileMaps(): Promise<MapPack[]> {
    if (!native()) return (await transaction<StoredMap[]>("readonly", store => store.getAll())).map(({blob: _, ...pack}) => pack);
    const {maps} = await NativeMaps.list();
    const result: MapPack[] = [];
    for (const map of maps) {
        const stored = localStorage.getItem(`rr_map_meta_${map.id}`);
        let metadata: MapPack | null = null;
        try { metadata = stored ? JSON.parse(stored) : null; } catch { /* Rebuild display metadata from the retained native file. */ }
        result.push(metadata ? {...metadata, size: map.size} : await describe(new PMTiles(new DeviceSource(map.id)), map.id, "가져온 지도", map.size));
    }
    return result;
}

export async function openOfflineMap(id: string) {
    if (isArea(id)) {
        const stored = await transaction<{id: string; data: ArrayBuffer} | undefined>("readonly", store => store.get(id), "areas");
        if (!stored) throw new Error("지도 파일이 없어요. 다시 저장해주세요.");
        return new PMTiles(new FileSource(new File([stored.data], `device-map-${id}`)));
    }
    if (native()) return new PMTiles(new DeviceSource(id));
    const stored = await transaction<StoredMap | undefined>("readonly", store => store.get(id));
    if (!stored) throw new Error("지도 파일이 없어요. 다시 저장해주세요.");
    return new PMTiles(new FileSource(new File([stored.blob], `device-map-${id}`)));
}

export async function importOfflineMap(file?: File, name?: string): Promise<MapPack> {
    if (!native()) {
        if (!file || file.size > MAX_BYTES) throw new Error("200MB 이하 지도 파일을 선택해주세요.");
        const id = crypto.randomUUID();
        const pack = await describe(new PMTiles(new FileSource(file)), id, name ?? file.name, file.size);
        const bytes = await file.arrayBuffer();
        await transaction("readwrite", store => store.put({...pack, blob: bytes}));
        selectOfflineMap(id);
        // Best effort: browsers can still remove site data; native files are app-private.
        await navigator.storage?.persist?.().catch(() => false);
        return pack;
    }
    const {id} = await NativeMaps.pick();
    return finishNativeImport(id, name ?? "가져온 지도");
}

async function finishNativeImport(id: string, name: string) {
    try {
        const {maps} = await NativeMaps.list();
        const pack = await describe(new PMTiles(new DeviceSource(id)), id, name, maps.find(map => map.id === id)?.size ?? 0);
        localStorage.setItem(`rr_map_meta_${id}`, JSON.stringify(pack));
        selectOfflineMap(id);
        return pack;
    } catch (error) { await NativeMaps.delete({id}).catch(() => {}); throw error; }
}

export async function downloadSampleMap() {
    const filePath = "/offline-maps/bukhansan.pmtiles";
    if (native()) {
        const site = process.env.NEXT_PUBLIC_SITE_URL || "https://run-river.vercel.app";
        const {id} = await NativeMaps.download({url: new URL(filePath, site).toString(), sha256: SAMPLE_SHA256});
        return finishNativeImport(id, "북한산 주변");
    }
    const response = await fetch(filePath);
    if (!response.ok) throw new Error("지도를 다운로드하지 못했어요. 인터넷 연결을 확인해주세요.");
    const blob = await response.blob();
    const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    const actual = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
    if (actual !== SAMPLE_SHA256) throw new Error("지도 파일 확인에 실패했어요. 다시 다운로드해주세요.");
    return importOfflineMap(new File([blob], "bukhansan.pmtiles"), "북한산 주변");
}

export async function deleteOfflineMap(id: string) {
    if (isArea(id)) {
        await transaction("readwrite", store => store.delete(id), "areas");
        writeAreaIndex(areaIndex().filter(pack => pack.id !== id));
    } else if (native()) { await NativeMaps.delete({id}); localStorage.removeItem(`rr_map_meta_${id}`); }
    else await transaction("readwrite", store => store.delete(id));
    if (selectedOfflineMap() === id) localStorage.removeItem(ACTIVE_KEY);
    window.dispatchEvent(new Event("offline-map-changed"));
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface AreaProgress {done: number; total: number; bytes: number}

/**
 * Saves the OpenFreeMap tiles covering `bounds` (zoom 8–14) as an offline map and selects it.
 * Tiles are fetched a few at a time; `signal` cancels the download.
 */
export async function downloadAreaMap(bounds: Bounds, name: string, onProgress: (progress: AreaProgress) => void, signal?: AbortSignal): Promise<MapPack> {
    const tiles = areaTiles(bounds);
    if (tiles.length > AREA_MAX_TILES) throw new Error("범위가 너무 넓어요. 지도를 확대해 범위를 줄여주세요.");
    const template = await openFreeMapTileTemplate().catch(() => { throw new Error("지도 서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요."); });
    const compress = typeof CompressionStream !== "undefined";
    const saved: AreaTile[] = [];
    let next = 0, done = 0, bytes = 0;
    // 한 worker가 실패하면 Promise.all은 바로 끝나지만 나머지 worker는 계속 돈다 → 내부 신호로 전부 멈추고 진행률 콜백도 막는다
    const stop = new AbortController();
    const abortFromCaller = () => stop.abort();
    if (signal?.aborted) stop.abort(); else signal?.addEventListener("abort", abortFromCaller, {once: true});
    const fetchTile = async (z: number, x: number, y: number) => {
        const url = template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
        for (let attempt = 0; ; attempt++) {
            try {
                const response = await fetch(url, {credentials: "omit", signal: stop.signal});
                if (response.status === 204 || response.status === 404) return null;
                if (!response.ok) throw new Error(`tile ${response.status}`);
                return new Uint8Array(await response.arrayBuffer());
            } catch (error) {
                if (stop.signal.aborted) throw new DOMException("지도 저장을 취소했어요.", "AbortError");
                if (attempt >= 2) throw new Error("지도를 다운로드하지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.", {cause: error});
                await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
            }
        }
    };
    const worker = async () => {
        while (next < tiles.length && !stop.signal.aborted) {
            const {z, x, y} = tiles[next++];
            const data = await fetchTile(z, x, y);
            if (data?.byteLength) {
                const stored = compress ? await gzip(data) : data;
                if (stop.signal.aborted) return;
                saved.push({z, x, y, data: stored}); bytes += stored.byteLength;
            }
            if (stop.signal.aborted) return;
            done++; onProgress({done, total: tiles.length, bytes});
        }
    };
    onProgress({done: 0, total: tiles.length, bytes: 0});
    try {
        await Promise.all(Array.from({length: 6}, () => worker().catch(error => { stop.abort(); throw error; })));
    } finally {
        signal?.removeEventListener("abort", abortFromCaller);
    }
    if (signal?.aborted) throw new DOMException("지도 저장을 취소했어요.", "AbortError");
    const archive = buildPmtiles(saved, {
        bounds: coveredBounds(bounds), minZoom: AREA_MIN_ZOOM, maxZoom: AREA_MAX_ZOOM, tileCompression: compress ? "gzip" : "none",
        metadata: {name, attribution: "© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap", vector_layers: OPENMAPTILES_LAYERS.map(id => ({id}))},
    });
    if (archive.byteLength > MAX_BYTES) throw new Error("지도가 200MB를 넘어요. 범위를 줄여주세요.");
    const id = `area-${crypto.randomUUID()}`;
    const pack = await describe(new PMTiles(new FileSource(new File([archive], id))), id, name, archive.byteLength);
    await transaction("readwrite", store => store.put({id, data: archive.buffer}), "areas");
    writeAreaIndex([pack, ...areaIndex()]);
    selectOfflineMap(id);
    await navigator.storage?.persist?.().catch(() => false);
    return pack;
}

export type NetworkKind = "wifi" | "cellular" | "unknown";
/** Wi-Fi or metered data, when the platform can tell (Android/Chrome via the Network Information API, iPhone app natively). */
export async function networkKind(): Promise<NetworkKind> {
    const type = (navigator as Navigator & {connection?: {type?: string}}).connection?.type;
    if (type === "wifi" || type === "ethernet") return "wifi";
    if (type === "cellular") return "cellular";
    if (Capacitor.getPlatform() === "ios") {
        const result = await Promise.race([NativeMaps.network().then(r => r.type).catch(() => "unknown"), new Promise<string>(resolve => setTimeout(() => resolve("unknown"), 2000))]);
        if (result === "wifi" || result === "cellular") return result;
    }
    return "unknown";
}
