import type {LatLng, TrackPoint, CourseOverlay} from "@/types";

export interface HikingCourse {name: string; points: LatLng[]; overlay?: CourseOverlay; selectedLine?: number}
const KEY = "rr_hiking_course_v1";
const valid = (point: LatLng) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

function validOverlay(value: CourseOverlay) {
    let count = 0;
    const position = (point: number[]) => Array.isArray(point) && point.length === 2 && ++count <= 10000 && valid({lng: point[0], lat: point[1]});
    if (!value || value.type !== "FeatureCollection" || !Array.isArray(value.features) || !value.features.length || value.features.length > 500) return false;
    return value.features.every(feature => {
        if (feature?.type !== "Feature" || typeof feature.properties?.name !== "string" || !feature.geometry) return false;
        const geometry = feature.geometry;
        if (geometry.type === "Point") return position(geometry.coordinates);
        if (geometry.type === "LineString") return Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2 && geometry.coordinates.every(position);
        if (geometry.type === "Polygon") return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(ring => Array.isArray(ring) && ring.length >= 4 && ring.every(position) && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1]);
        return false;
    });
}

export function parseGpx(xml: string, fallbackName = "나의 산행 코스"): HikingCourse {
    if (xml.length > 5 * 1024 * 1024) throw new Error("GPX는 5MB 이하 파일을 사용해주세요.");
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("외부 정의가 포함된 GPX는 사용할 수 없어요.");
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.getElementsByTagName("parsererror").length || document.documentElement.localName !== "gpx") throw new Error("올바른 GPX 파일을 선택해주세요.");
    const segments = document.getElementsByTagNameNS("*", "trkseg");
    const routes = document.getElementsByTagNameNS("*", "rte");
    if (segments.length + routes.length !== 1) throw new Error("하나의 연속된 트랙 또는 경로가 담긴 GPX를 사용해주세요.");
    const container = segments[0] ?? routes[0];
    const elements = container.getElementsByTagNameNS("*", segments.length ? "trkpt" : "rtept");
    if (elements.length < 2 || elements.length > 10000) throw new Error("코스는 2~10,000개의 지점을 포함해야 해요.");
    const points = Array.from(elements, element => {
        const latitude = element.getAttribute("lat"), longitude = element.getAttribute("lon");
        if (!latitude?.trim() || !longitude?.trim()) throw new Error("코스에 좌표가 없는 지점이 있어요.");
        const point = {lat: Number(latitude), lng: Number(longitude)};
        if (!valid(point)) throw new Error("코스에 올바르지 않은 좌표가 있어요.");
        return point;
    });
    const name = document.getElementsByTagNameNS("*", "name")[0]?.textContent?.trim() || fallbackName;
    return {name: name.slice(0, 80), points};
}

export function saveHikingCourse(course: HikingCourse) { localStorage.setItem(KEY, JSON.stringify(course)); }
export function readHikingCourse(): HikingCourse | null {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const course = JSON.parse(raw) as HikingCourse;
    if (course.overlay && !validOverlay(course.overlay)) throw new Error("저장한 지도 표시를 읽지 못했어요. 코스 파일을 다시 가져와주세요.");
    if (typeof course.name !== "string" || !Array.isArray(course.points) || (course.points.length < 2 && !course.overlay?.features?.length) || course.points.length > 10000 || !course.points.every(valid)) throw new Error("저장한 코스를 읽지 못했어요. 코스 파일을 다시 가져와주세요.");
    return course;
}
export function clearHikingCourse() { localStorage.removeItem(KEY); }

/** Distance to line segments, not merely the nearest sampled GPX point. */
export function distanceToCourseMeters(point: LatLng, course: LatLng[]): number {
    const scaleX = 111320 * Math.cos(point.lat * Math.PI / 180);
    const scaleY = 111320;
    let best = Infinity;
    for (let index = 1; index < course.length; index++) {
        const a = {x: (course[index - 1].lng - point.lng) * scaleX, y: (course[index - 1].lat - point.lat) * scaleY};
        const b = {x: (course[index].lng - point.lng) * scaleX, y: (course[index].lat - point.lat) * scaleY};
        const dx = b.x - a.x, dy = b.y - a.y;
        const length = dx * dx + dy * dy;
        const t = length === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / length));
        best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
    }
    return best;
}

const escapeXml = (text: string) => text.replace(/[<>&"']/g, character => ({"<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;"}[character]!));
export function buildGpx(name: string, points: (LatLng & Partial<TrackPoint>)[]) {
    if (!points.length || !points.every(valid)) throw new Error("내보낼 GPS 경로가 없어요.");
    let previousTime: number | undefined;
    const segments: string[][] = [[]];
    for (const point of points) {
        if (segments.at(-1)!.length && (point.segment_start || (point.timestamp !== undefined && previousTime !== undefined && point.timestamp - previousTime > 30000))) segments.push([]);
        const altitude = typeof point.altitude_m === "number" && Number.isFinite(point.altitude_m) ? `<ele>${point.altitude_m}</ele>` : "";
        const time = typeof point.timestamp === "number" && Number.isFinite(point.timestamp) ? `<time>${new Date(point.timestamp).toISOString()}</time>` : "";
        segments.at(-1)!.push(`<trkpt lat="${point.lat}" lon="${point.lng}">${altitude}${time}</trkpt>`);
        previousTime = point.timestamp;
    }
    return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Run River" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${escapeXml(name)}</name>${segments.map(segment => `<trkseg>${segment.join("")}</trkseg>`).join("")}</trk></gpx>`;
}
