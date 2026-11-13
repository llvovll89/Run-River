import type {RunRecoverySnapshot, LatLng} from "@/types";

export const ACTIVE_RUN_KEY = "rr_active_run";
const LOCAL_RESULTS_KEY = "rr_local_results";

function isPoint(value: unknown): value is LatLng {
    if (!value || typeof value !== "object") return false;
    const point = value as LatLng;
    return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

export interface LocalRunResult {
    id: string;
    ownerId?: string | null;
    startPoint: LatLng;
    endPoint: LatLng;
    distance_km: number;
    duration_seconds: number;
    pace: number;
    activity_type: "running" | "walking";
    pathPoints?: LatLng[];
}
export interface LocalResultEntry {
    result: LocalRunResult;
    savedAt: number;
    uploaded: boolean;
}

export function readActiveRun(): RunRecoverySnapshot | null {
    const raw = localStorage.getItem(ACTIVE_RUN_KEY) ?? sessionStorage.getItem("runInProgress");
    if (!raw) return null;
    const value = JSON.parse(raw) as RunRecoverySnapshot;
    if (!value || value.version !== 1 || !value.config || !isPoint(value.config.startPoint) ||
        (value.config.endPoint !== null && !isPoint(value.config.endPoint)) ||
        !["running", "walking"].includes(value.config.activityType) ||
        !Array.isArray(value.pathPoints) || !value.pathPoints.every(isPoint) ||
        !Number.isFinite(value.elapsed) || !Number.isFinite(value.totalDistance) ||
        !Number.isFinite(value.updatedAt) || typeof value.isPaused !== "boolean") {
        throw new Error("진행 중인 기록을 읽을 수 없습니다. 기기의 저장 공간을 확인해주세요.");
    }
    return value;
}
export function writeActiveRun(snapshot: RunRecoverySnapshot) {
    localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(snapshot));
}
export function clearActiveRun() {
    localStorage.removeItem(ACTIVE_RUN_KEY);
    sessionStorage.removeItem("runInProgress");
}
export function readLocalResults(): LocalResultEntry[] {
    const raw = localStorage.getItem(LOCAL_RESULTS_KEY);
    if (!raw) return [];
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values) || values.some((value) => !value?.result?.id ||
        !Number.isFinite(value.result.distance_km) || !Number.isFinite(value.result.duration_seconds) ||
        !isPoint(value.result.startPoint) || !isPoint(value.result.endPoint))) {
        throw new Error("기기 기록을 읽을 수 없습니다. 저장된 데이터를 지우지 말고 다시 시도해주세요.");
    }
    return values;
}
export function saveLocalResult(result: LocalRunResult) {
    const entries = readLocalResults();
    if (!entries.some((entry) => entry.result.id === result.id)) {
        entries.unshift({result, savedAt: Date.now(), uploaded: false});
        localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(entries));
    }
}
export function markLocalResultUploaded(id: string) {
    const entries = readLocalResults().map((entry) => entry.result.id === id ? {...entry, uploaded: true} : entry);
    localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(entries));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("local-run-uploaded", {detail: id}));
}
export function removeLocalResult(id: string) {
    localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(readLocalResults().filter((entry) => entry.result.id !== id)));
}
export function navigatePublic(path: string) {
    window.location.assign(path);
}
