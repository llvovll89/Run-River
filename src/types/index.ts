export interface LatLng {
  lat: number;
  lng: number;
}

export type ActivityType = "running" | "walking";

export interface TrackPoint extends LatLng {
  timestamp: number;
  elapsed_seconds: number;
  distance_km: number;
  altitude_m: number | null;
}

export interface RunningRecord {
  id: string;
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
  memo?: string | null;
  created_at: string;
}

import type { IntervalPreset } from "@/lib/intervalPresets";
export type { IntervalPreset };

/** sessionStorage에 저장되는 런 시작 설정 */
export interface RunConfig {
  startPoint: LatLng;
  endPoint: LatLng | null;
  activityType: ActivityType;
  /** 목표 거리 모드일 때 설정 (km). null이면 지도/시간 모드 */
  goalDistance: number | null;
  /** 목표 시간 모드일 때 설정 (분). null이면 지도/거리 모드 */
  goalTime: number | null;
  intervalPreset?: IntervalPreset;
}

export interface RunRecoverySnapshot {
  version: 1;
  updatedAt: number;
  config: RunConfig;
  elapsed: number;
  isPaused: boolean;
  totalDistance: number;
  pathPoints: LatLng[];
  trackPoints: TrackPoint[];
  currentAltitude: number | null;
  startAltitude: number | null;
  endAltitude: number | null;
  elevationGain: number;
  elevationLoss: number;
}

export interface UserProfile {
  weight: number;
  height: number;
  age: number;
  weeklyGoalKm: number;
  autoPause: boolean;
}

export interface RunningState {
  startPoint: LatLng | null;
  endPoint: LatLng | null;
  currentPosition: LatLng | null;
  isRunning: boolean;
  startTime: number | null;
  distance: number;
  activityType: ActivityType;
}
