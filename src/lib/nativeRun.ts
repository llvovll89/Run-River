import {Capacitor, registerPlugin} from "@capacitor/core";
import type {RunConfig, TrackPoint, LatLng} from "@/types";
import {calcPace} from "@/lib/utils";

export interface NativeRunSnapshot {
    config: RunConfig & {runId: string};
    status: "paused" | "recording" | "finished";
    elapsedMs: number;
    distanceKm: number;
    trackPoints: TrackPoint[];
    position?: LatLng;
    accuracy?: number;
    lastFixAt?: number;
    startAltitude?: number;
    currentAltitude?: number;
    elevationGain: number;
    elevationLoss: number;
    error?: string | null;
}

interface NativeRunPlugin {
    start(options: {config: RunConfig}): Promise<void>;
    snapshot(): Promise<{run: NativeRunSnapshot | null}>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    finish(): Promise<void>;
    acknowledge(options: {runId: string}): Promise<void>;
}

export const NativeRun = registerPlugin<NativeRunPlugin>("NativeRun");
export function hasNativeRun() { return Capacitor.getPlatform() === "android"; }

export function nativeRunResult(run: NativeRunSnapshot) {
    const duration = Math.floor(run.elapsedMs / 1000);
    return {
        id: run.config.runId,
        ownerId: run.config.ownerId ?? null,
        startPoint: run.config.startPoint,
        endPoint: run.position ?? run.config.startPoint,
        distance_km: run.distanceKm,
        gps_distance_km_raw: run.distanceKm,
        duration_seconds: duration,
        pace: calcPace(run.distanceKm, duration),
        activity_type: run.config.activityType,
        pathPoints: run.trackPoints.map(({lat, lng}) => ({lat, lng})),
        trackPoints: run.trackPoints,
        altitude_start_m: run.startAltitude ?? null,
        altitude_end_m: run.currentAltitude ?? null,
        elevation_gain_m: run.elevationGain,
        elevation_loss_m: run.elevationLoss,
    };
}
