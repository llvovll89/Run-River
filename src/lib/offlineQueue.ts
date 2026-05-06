import type { LatLng, ActivityType } from "@/types";

const QUEUE_KEY = "pendingRunRecords";
const MAX_RETRY_COUNT = 5;
export const RETRY_EXHAUSTED_AT = Number.MAX_SAFE_INTEGER;

export interface SaveRecordPayload {
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

export function getQueue(): PendingRecord[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingRecord[]) : [];
  } catch {
    return [];
  }
}

export function enqueue(record: SaveRecordPayload): void {
  const queue = getQueue();
  queue.push({
    queueId: crypto.randomUUID(),
    record,
    savedAt: Date.now(),
    retryCount: 0,
    lastError: null,
    nextRetryAt: 0,
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function dequeue(id: string): void {
  const queue = getQueue().filter((item) => item.queueId !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function markRetry(id: string, errorMessage: string): void {
  const now = Date.now();
  const queue = getQueue().map((item) => {
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
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function resetRetry(id: string): void {
  const queue = getQueue().map((item) => {
    if (item.queueId !== id) return item;
    return {
      ...item,
      retryCount: 0,
      lastError: null,
      nextRetryAt: 0,
    };
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
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
