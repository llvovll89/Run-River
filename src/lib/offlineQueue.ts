import type { LatLng, ActivityType } from "@/types";

const QUEUE_KEY = "pendingRunRecords";

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
  queue.push({ queueId: crypto.randomUUID(), record, savedAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function dequeue(id: string): void {
  const queue = getQueue().filter((item) => item.queueId !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
