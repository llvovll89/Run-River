import type { ActivityType } from "@/types";

// 기준점이 이 시간보다 오래되면, 거부된 점이라도 새 기준점으로 삼는다 (거리 누적이 영구히 멈추는 것 방지)
export const STALE_ANCHOR_SECONDS = 30;

export type DistanceSampleDecision = "accept" | "reject" | "reanchor";

interface DistanceSample {
  distanceKm: number;
  deltaSeconds: number;
  accuracyMeters: number;
  activityType: ActivityType;
}

export function evaluateDistanceSample({ distanceKm, deltaSeconds, accuracyMeters, activityType }: DistanceSample): DistanceSampleDecision {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters > 40) return "reject";
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return "reject";
  if (distanceKm < 0.001) return "reject";

  // 고정 거리 상한 대신 경과 시간 기반 속도로 판정: 신호가 잠깐 끊겼다 돌아와도 실제 이동은 반영된다
  const speedKmh = (distanceKm / deltaSeconds) * 3600;
  const maxSpeed = activityType === "running" ? 25 : 9;
  if (speedKmh <= maxSpeed) return "accept";

  return deltaSeconds >= STALE_ANCHOR_SECONDS ? "reanchor" : "reject";
}

// 자동 재개 판정: 최근 속도 샘플이 연속으로 기준 이상이거나, 멈춘 지점에서 충분히 벗어났을 때
export const AUTO_RESUME_SPEED_SAMPLES = 2;
export const AUTO_RESUME_DISPLACEMENT_KM = 0.02;

interface AutoResumeInput {
  speedSamples: number[];
  displacementKm: number;
  accuracyMeters: number;
  resumeSpeedMs: number;
}

export function shouldAutoResume({ speedSamples, displacementKm, accuracyMeters, resumeSpeedMs }: AutoResumeInput): boolean {
  // 제자리 GPS 흔들림을 이동으로 오인하지 않도록 정확도 반경보다 멀리 벗어나야 인정
  const minDisplacementKm = Math.max(AUTO_RESUME_DISPLACEMENT_KM, accuracyMeters / 1000);
  if (displacementKm >= minDisplacementKm) return true;
  const recent = speedSamples.slice(-AUTO_RESUME_SPEED_SAMPLES);
  return recent.length === AUTO_RESUME_SPEED_SAMPLES && recent.every((value) => value >= resumeSpeedMs);
}
