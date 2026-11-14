import {Capacitor, registerPlugin} from "@capacitor/core";
import {PMTiles, FileSource, type Source, type RangeResponse} from "pmtiles";

export interface MapPack {
    id: string;
    name: string;
    size: number;
    bounds: [number, number, number, number];
    maxZoom: number;
    createdAt: number;
}
interface StoredMap extends MapPack {blob: Blob}
const ACTIVE_KEY = "rr_offline_map";
const MAX_BYTES = 200 * 1024 * 1024;
const SAMPLE_SHA256 = "0791c9747ec5eb2450541f01394feb37491050b88ff4415a1d4e7fd4de987189";
const NativeMaps = registerPlugin<{
    pick(): Promise<{id: string}>;
    download(options: {url: string; sha256: string}): Promise<{id: string}>;
    list(): Promise<{maps: {id: string; size: number}[]}>;
    read(options: {id: string; offset: number; length: number}): Promise<{base64: string}>;
    delete(options: {id: string}): Promise<void>;
}>("NativeMaps");
const native = () => ["android", "ios"].includes(Capacitor.getPlatform());

async function db() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("run-river-maps", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("maps", {keyPath: "id"});
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await db();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = database.transaction("maps", mode);
            const request = action(tx.objectStore("maps"));
            tx.oncomplete = () => resolve(request.result);
            tx.onabort = () => reject(tx.error ?? new Error("지도를 저장하지 못했어요. 기기 공간을 확인해주세요."));
            tx.onerror = () => reject(tx.error);
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
    if (header.specVersion !== 3 || header.tileType !== 1 || !metadata.vector_layers?.some(layer => layer.id === "roads")) {
        throw new Error("Protomaps 형식의 PMTiles v3 벡터 지도를 사용해주세요.");
    }
    const bounds: MapPack["bounds"] = [header.minLon, header.minLat, header.maxLon, header.maxLat];
    if (bounds.some(value => !Number.isFinite(value)) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) throw new Error("지도 영역을 읽을 수 없어요.");
    return {id, name: name || metadata.name || "가져온 지도", size, bounds, maxZoom: header.maxZoom, createdAt: Date.now()};
}

export function selectOfflineMap(id: string) {
    localStorage.setItem(ACTIVE_KEY, id);
    window.dispatchEvent(new Event("offline-map-changed"));
}
export function selectedOfflineMap() { return localStorage.getItem(ACTIVE_KEY); }

export async function listOfflineMaps(): Promise<MapPack[]> {
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
        await transaction("readwrite", store => store.put({...pack, blob: file}));
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
    if (native()) { await NativeMaps.delete({id}); localStorage.removeItem(`rr_map_meta_${id}`); }
    else await transaction("readwrite", store => store.delete(id));
    if (selectedOfflineMap() === id) localStorage.removeItem(ACTIVE_KEY);
    window.dispatchEvent(new Event("offline-map-changed"));
}
