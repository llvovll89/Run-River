import type { LatLng, ActivityType } from "@/types";

const QUEUE_KEY = "pendingRunRecords";
const MAX_RETRY_COUNT = 5;
const MAX_QUEUE_ITEMS = 300;
export const RETRY_EXHAUSTED_AT = Number.MAX_SAFE_INTEGER;

export interface SaveRecordPayload {
  id?: string;
  user_id?: string;
  gps_distance_km_raw?: number | null;
  gap_adjustment_distance_km?: number | null;
  gap_adjustment_seconds?: number | null;
  gap_adjustment_count?: number | null;
  gap_adjustment_auto_enabled?: boolean | null;
  start_point: LatLng;
  end_point: LatLng;
  distance_km: number;
  duration_seconds: number;
  pace: number;
  activity_type: ActivityType;
  altitude_start_m?: number | null;
  altitude_end_m?: number | null;
  elevation_gain_m?: number | null;
  elevation_loss_m?: number | null;
}

export interface PendingRecord {
  queueId: string;
  record: SaveRecordPayload;
  savedAt: number;
  retryCount: number;
  lastError: string | null;
  nextRetryAt: number;
}

export interface QueueSummary {
  pendingCount: number;
  blockedCount: number;
  exhaustedCount: number;
  nextRetryAt: number | null;
}

function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LatLng>;
  return typeof candidate.lat === "number" && Number.isFinite(candidate.lat) && Math.abs(candidate.lat) <= 90 &&
    typeof candidate.lng === "number" && Number.isFinite(candidate.lng) && Math.abs(candidate.lng) <= 180;
}

function isActivityType(value: unknown): value is ActivityType {
  return value === "running" || value === "walking" || value === "hiking";
}

function isSaveRecordPayload(value: unknown): value is SaveRecordPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SaveRecordPayload>;
  return (
    isLatLng(candidate.start_point) &&
    isLatLng(candidate.end_point) &&
    typeof candidate.distance_km === "number" &&
    Number.isFinite(candidate.distance_km) &&
    typeof candidate.duration_seconds === "number" &&
    Number.isFinite(candidate.duration_seconds) &&
    typeof candidate.pace === "number" &&
    Number.isFinite(candidate.pace) &&
    isActivityType(candidate.activity_type)
  );
}

function isPendingRecord(value: unknown): value is PendingRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PendingRecord>;
  return (
    typeof candidate.queueId === "string" &&
    candidate.queueId.length > 0 &&
    isSaveRecordPayload(candidate.record) &&
    typeof candidate.savedAt === "number" &&
    Number.isFinite(candidate.savedAt) &&
    typeof candidate.retryCount === "number" &&
    Number.isFinite(candidate.retryCount) &&
    typeof candidate.nextRetryAt === "number" &&
    Number.isFinite(candidate.nextRetryAt) &&
    (typeof candidate.lastError === "string" || candidate.lastError === null)
  );
}

function writeQueue(queue: PendingRecord[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function readQueueStrict(): PendingRecord[] {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(isPendingRecord)) {
      throw new Error("업로드 대기 기록을 읽을 수 없습니다. 기존 데이터는 유지됩니다.");
    }
    return parsed;
}

export function getQueue(): PendingRecord[] {
  try { return readQueueStrict(); } catch { return []; }
}

export function enqueue(record: SaveRecordPayload): void {
  const queue = readQueueStrict();
  if (record.id && queue.some((item) => item.record.id === record.id)) return;
  if (queue.length >= MAX_QUEUE_ITEMS) throw new Error("업로드 대기열이 가득 찼습니다. 기기 기록은 유지됩니다.");
  queue.push({
    queueId: record.id ?? crypto.randomUUID(),
    record,
    savedAt: Date.now(),
    retryCount: 0,
    lastError: null,
    nextRetryAt: 0,
  });
  writeQueue(queue);
}

export function dequeue(id: string): void {
  const queue = readQueueStrict().filter((item) => item.queueId !== id);
  writeQueue(queue);
}

export function markRetry(id: string, errorMessage: string): void {
  const now = Date.now();
  const queue = readQueueStrict().map((item) => {
    if (item.queueId !== id) return item;
    const retryCount = item.retryCount + 1;
    if (retryCount >= MAX_RETRY_COUNT) {
      return {
        ...item,
        retryCount,
        lastError: errorMessage,
        nextRetryAt: RETRY_EXHAUSTED_AT,
      };
    }
    const backoffMs = Math.min(5 * 60 * 1000, Math.pow(2, retryCount - 1) * 5000);
    return {
      ...item,
      retryCount,
      lastError: errorMessage,
      nextRetryAt: now + backoffMs,
    };
  });
  writeQueue(queue);
}

export function resetRetry(id: string): void {
  const queue = readQueueStrict().map((item) => {
    if (item.queueId !== id) return item;
    return {
      ...item,
      retryCount: 0,
      lastError: null,
      nextRetryAt: 0,
    };
  });
  writeQueue(queue);
}

export function getQueueSummary(): QueueSummary {
  const queue = getQueue();
  const now = Date.now();
  const blocked = queue.filter((item) => item.nextRetryAt > now);
  const exhausted = queue.filter((item) => item.nextRetryAt === RETRY_EXHAUSTED_AT);
  const nextRetryAt = blocked.length > 0
    ? Math.min(...blocked.map((item) => item.nextRetryAt))
    : null;

  return {
    pendingCount: queue.length,
    blockedCount: blocked.length,
    exhaustedCount: exhausted.length,
    nextRetryAt,
  };
}

export function getExhaustedQueue(): PendingRecord[] {
  return getQueue().filter((item) => item.nextRetryAt === RETRY_EXHAUSTED_AT);
}

export function resetAllExhaustedRetries(): number {
  const queue = readQueueStrict();
  let updated = 0;
  const next = queue.map((item) => {
    if (item.nextRetryAt !== RETRY_EXHAUSTED_AT) return item;
    updated += 1;
    return {
      ...item,
      retryCount: 0,
      lastError: null,
      nextRetryAt: 0,
    };
  });
  writeQueue(next);
  return updated;
}
