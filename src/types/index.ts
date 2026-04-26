export interface LatLng {
  lat: number;
  lng: number;
}

export type ActivityType = "running" | "walking";

export interface RunningRecord {
  id: string;
  start_point: LatLng;
  end_point: LatLng;
  distance_km: number;
  duration_seconds: number;
  pace: number;
  activity_type: ActivityType;
  created_at: string;
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
