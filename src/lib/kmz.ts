import {Unzip, UnzipInflate} from "fflate";
import type {CourseOverlay} from "@/types";
import type {HikingCourse} from "@/lib/hiking";

const MAX_XML = 5 * 1024 * 1024;
const MAX_POINTS = 10000;
const MAX_FEATURES = 500;

/** Only KML is inflated; images and linked resources are never opened or fetched. */
export function extractKmz(bytes: Uint8Array): string {
    if (bytes.length > 10 * 1024 * 1024) throw new Error("KMZ는 10MB 이하 파일을 사용해주세요.");
    // A complete ZIP needs an end record; do not accept a truncated local-file stream.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let complete = false;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
        if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { complete = true; break; }
    }
    if (!complete) throw new Error("KMZ 압축 파일이 손상되었어요.");
    const documents = new Map<string, Uint8Array[]>();
    const finished = new Set<string>();
    let total = 0, count = 0;
    const unzip = new Unzip(file => {
        if (++count > 200) throw new Error("KMZ에 파일이 너무 많아요. 200개 이하로 준비해주세요.");
        const name = file.name.replaceAll("\\", "/");
        if (name.startsWith("/") || /^[a-z]:/i.test(name) || name.split("/").includes("..")) throw new Error("안전하지 않은 KMZ 파일 경로입니다.");
        if (!/\.kml$/i.test(name)) return;
        if (documents.has(name.toLowerCase())) throw new Error("KMZ에 중복된 KML 파일이 있어요.");
        if ((file.originalSize ?? 0) > MAX_XML) throw new Error("압축을 푼 KML은 5MB 이하여야 해요.");
        const chunks: Uint8Array[] = [];
        documents.set(name.toLowerCase(), chunks);
        file.ondata = (error, data, final) => {
            if (error) throw new Error("KMZ 압축을 풀지 못했어요.");
            total += data.length;
            if (total > MAX_XML) { file.terminate(); throw new Error("압축을 푼 KML은 합계 5MB 이하여야 해요."); }
            chunks.push(data);
            if (final) finished.add(name.toLowerCase());
        };
        file.start();
    });
    unzip.register(UnzipInflate);
    try {
        for (let offset = 0; offset < bytes.length; offset += 1024) unzip.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
    } catch (error) { throw new Error(error instanceof Error ? error.message : "KMZ 압축을 풀지 못했어요."); }
    const selected = documents.has("doc.kml") ? "doc.kml" : documents.size === 1 ? [...documents.keys()][0] : null;
    if (!selected) throw new Error("KMZ 안에 doc.kml 또는 하나의 KML 파일이 있어야 해요.");
    if (!finished.has(selected)) throw new Error("KMZ 압축 파일이 손상되었어요.");
    const chunks = documents.get(selected)!;
    const data = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
    let cursor = 0;
    for (const chunk of chunks) { data.set(chunk, cursor); cursor += chunk.length; }
    try { return new TextDecoder("utf-8", {fatal: true}).decode(data); }
    catch { throw new Error("UTF-8 형식의 KML 파일을 사용해주세요."); }
}

function children(element: Element, name: string) { return Array.from(element.children).filter(child => child.localName === name); }
function child(element: Element, name: string) { return children(element, name)[0]; }

export function parseKml(xml: string, fallbackName = "가져온 지도"): HikingCourse {
    if (xml.length > MAX_XML) throw new Error("KML은 5MB 이하 파일을 사용해주세요.");
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("외부 정의가 포함된 KML은 사용할 수 없어요.");
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.getElementsByTagNameNS("*", "parsererror").length || document.documentElement.localName !== "kml") throw new Error("올바른 KML 파일을 선택해주세요.");
    const overlay: CourseOverlay = {type: "FeatureCollection", features: []};
    let pointCount = 0;
    function coordinates(element: Element): number[][] {
        const text = child(element, "coordinates")?.textContent?.trim();
        if (!text) throw new Error("KML에 좌표가 없는 지점이 있어요.");
        return text.split(/\s+/).map(tuple => {
            if (++pointCount > MAX_POINTS) throw new Error("KML은 합계 10,000개 이하 좌표를 지원해요.");
            const values = tuple.split(",");
            if (values.length < 2 || values.length > 3 || values.some(value => !value.trim() || !Number.isFinite(Number(value)))) throw new Error("KML 좌표 형식을 확인해주세요.");
            const [lng, lat] = values.map(Number);
            if (Math.abs(lng) > 180 || Math.abs(lat) > 90) throw new Error("KML 좌표 범위를 확인해주세요.");
            return [lng, lat];
        });
    }
    function ring(boundary: Element | undefined) {
        const linear = boundary && child(boundary, "LinearRing");
        if (!linear) throw new Error("KML 구역의 테두리를 읽을 수 없어요.");
        const points = coordinates(linear);
        if (points.length < 4 || points[0][0] !== points.at(-1)![0] || points[0][1] !== points.at(-1)![1]) throw new Error("KML 구역은 닫힌 테두리여야 해요.");
        return points;
    }
    function geometry(element: Element, name: string) {
        if (element.localName === "MultiGeometry") { for (const nested of Array.from(element.children)) geometry(nested, name); return; }
        if (!["Point", "LineString", "Polygon"].includes(element.localName)) return;
        if (overlay.features.length >= MAX_FEATURES) throw new Error("KML은 500개 이하 경로·장소·구역을 지원해요.");
        const properties = {name};
        if (element.localName === "Point") {
            const points = coordinates(element);
            if (points.length !== 1) throw new Error("KML 장소에는 좌표 하나가 필요해요.");
            overlay.features.push({type: "Feature", properties, geometry: {type: "Point", coordinates: points[0]}});
        } else if (element.localName === "LineString") {
            const points = coordinates(element);
            if (points.length < 2) throw new Error("KML 경로에는 좌표가 두 개 이상 필요해요.");
            overlay.features.push({type: "Feature", properties, geometry: {type: "LineString", coordinates: points}});
        } else {
            overlay.features.push({type: "Feature", properties, geometry: {type: "Polygon", coordinates: [ring(child(element, "outerBoundaryIs")), ...children(element, "innerBoundaryIs").map(boundary => ring(boundary))]}});
        }
    }
    for (const placemark of Array.from(document.getElementsByTagNameNS("*", "Placemark"))) {
        const name = (child(placemark, "name")?.textContent?.trim() || "이름 없는 표시").slice(0, 80);
        for (const element of Array.from(placemark.children)) geometry(element, name);
    }
    if (!overlay.features.length) throw new Error("표시할 경로·장소·구역이 없어요. 이미지 오버레이와 외부 링크는 지원하지 않아요.");
    const title = child(document.documentElement, "Document");
    const name = (title && child(title, "name")?.textContent?.trim()) || fallbackName;
    const lines = overlay.features.filter(feature => feature.geometry.type === "LineString");
    const points = lines.length === 1 && lines[0].geometry.type === "LineString" ? lines[0].geometry.coordinates.map(([lng, lat]) => ({lat, lng})) : [];
    return {name: name.slice(0, 80), points, overlay, selectedLine: lines.length === 1 ? 0 : undefined};
}
