import {test, beforeEach} from "node:test";
import assert from "node:assert/strict";
import {readActiveRun, writeActiveRun, clearActiveRun, saveLocalResult, readLocalResults, markLocalResultUploaded} from "../src/lib/runStorage";
import {enqueue, getQueue, markRetry, resetRetry, RETRY_EXHAUSTED_AT} from "../src/lib/offlineQueue";
import type {RunRecoverySnapshot} from "../src/types";
import {formatPace} from "../src/lib/utils";

class MemoryStorage {
    values = new Map<string, string>();
    getItem(key: string) { return this.values.get(key) ?? null; }
    setItem(key: string, value: string) { this.values.set(key, value); }
    removeItem(key: string) { this.values.delete(key); }
}
beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {value: new MemoryStorage(), configurable: true});
    Object.defineProperty(globalThis, "sessionStorage", {value: new MemoryStorage(), configurable: true});
});
const point = {lat: 37.5665, lng: 126.978};
const snapshot: RunRecoverySnapshot = {
    version: 1, updatedAt: Date.now(), config: {startPoint: point, endPoint: null, activityType: "running", goalDistance: 5, goalTime: null},
    elapsed: 60, isPaused: true, totalDistance: 0.1, pathPoints: [point], trackPoints: [],
    currentAltitude: null, startAltitude: null, endAltitude: null, elevationGain: 0, elevationLoss: 0,
};
const result = {id: "run-1", startPoint: point, endPoint: point, distance_km: 0.1, duration_seconds: 60, pace: 600, activity_type: "running" as const, pathPoints: [point]};
const payload = {id: "run-1", user_id: "owner-a", start_point: point, end_point: point, distance_km: 0.1, duration_seconds: 60, pace: 600, activity_type: "running" as const};

test("active run survives loss of the tab's session storage", () => {
    writeActiveRun(snapshot);
    Object.defineProperty(globalThis, "sessionStorage", {value: new MemoryStorage(), configurable: true});
    assert.deepEqual(readActiveRun(), snapshot);
    clearActiveRun();
    assert.equal(readActiveRun(), null);
});
test("pace rounds across the minute boundary without displaying sixty seconds", () => {
    assert.equal(formatPace(2.999), "3'00\"");
    assert.equal(formatPace(5.5), "5'30\"");
});
test("legacy tab snapshot can still be read", () => {
    sessionStorage.setItem("runInProgress", JSON.stringify(snapshot));
    assert.deepEqual(readActiveRun(), snapshot);
});
test("invalid recovery is preserved instead of overwritten", () => {
    localStorage.setItem("rr_active_run", "broken");
    assert.throws(readActiveRun);
    assert.equal(localStorage.getItem("rr_active_run"), "broken");
});
test("guest results keep the route and are stable across repeated saves", () => {
    saveLocalResult(result);
    saveLocalResult(result);
    assert.equal(readLocalResults().length, 1);
    assert.deepEqual(readLocalResults()[0].result.pathPoints, [point]);
    markLocalResultUploaded(result.id);
    assert.equal(readLocalResults()[0].uploaded, true);
});
test("storage quota errors propagate without claiming a successful save", () => {
    localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    assert.throws(() => saveLocalResult(result), /QuotaExceeded/);
    assert.throws(() => writeActiveRun(snapshot), /QuotaExceeded/);
});
test("queue uses a stable ID and retains all analysis fields", () => {
    enqueue({...payload, gap_adjustment_distance_km: 0.02});
    enqueue(payload);
    assert.equal(getQueue().length, 1);
    assert.equal(getQueue()[0].queueId, payload.id);
    assert.equal(getQueue()[0].record.gap_adjustment_distance_km, 0.02);
});
test("a full queue refuses a new entry instead of dropping old workouts", () => {
    for (let i = 0; i < 300; i++) enqueue({...payload, id: `run-${i}`});
    assert.throws(() => enqueue({...payload, id: "overflow"}));
    assert.equal(getQueue().length, 300);
    assert.equal(getQueue()[0].record.id, "run-0");
});
test("corrupt queue is preserved and blocks overwriting", () => {
    localStorage.setItem("pendingRunRecords", "corrupt");
    assert.deepEqual(getQueue(), []);
    assert.throws(() => enqueue(payload));
    assert.equal(localStorage.getItem("pendingRunRecords"), "corrupt");
});
test("failed uploads back off, exhaust, and can be retried without losing data", () => {
    enqueue(payload);
    for (let i = 0; i < 5; i++) markRetry(payload.id, "network");
    assert.equal(getQueue()[0].nextRetryAt, RETRY_EXHAUSTED_AT);
    resetRetry(payload.id);
    assert.equal(getQueue()[0].retryCount, 0);
    assert.deepEqual(getQueue()[0].record, payload);
});
