export interface RunTuning {
  autoPauseStopSpeedMs: number;
  autoPauseResumeSpeedMs: number;
  autoPauseStillnessMs: number;
  autoPauseMinMoveKm: number;
  offRouteThresholdKm: number;
  offRouteSustainMs: number;
  offRouteAlertCooldownMs: number;
}

const STORAGE_KEY = "runTuningV1";

export const DEFAULT_RUN_TUNING: RunTuning = {
  autoPauseStopSpeedMs: 0.45,
  autoPauseResumeSpeedMs: 0.9,
  autoPauseStillnessMs: 4500,
  autoPauseMinMoveKm: 0.0003,
  offRouteThresholdKm: 0.06,
  offRouteSustainMs: 10000,
  offRouteAlertCooldownMs: 90000,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRunTuning(input: Partial<RunTuning> | null | undefined): RunTuning {
  return {
    autoPauseStopSpeedMs: clamp(input?.autoPauseStopSpeedMs ?? DEFAULT_RUN_TUNING.autoPauseStopSpeedMs, 0.2, 1.2),
    autoPauseResumeSpeedMs: clamp(input?.autoPauseResumeSpeedMs ?? DEFAULT_RUN_TUNING.autoPauseResumeSpeedMs, 0.3, 2.0),
    autoPauseStillnessMs: clamp(input?.autoPauseStillnessMs ?? DEFAULT_RUN_TUNING.autoPauseStillnessMs, 2000, 12000),
    autoPauseMinMoveKm: clamp(input?.autoPauseMinMoveKm ?? DEFAULT_RUN_TUNING.autoPauseMinMoveKm, 0.0001, 0.002),
    offRouteThresholdKm: clamp(input?.offRouteThresholdKm ?? DEFAULT_RUN_TUNING.offRouteThresholdKm, 0.02, 0.2),
    offRouteSustainMs: clamp(input?.offRouteSustainMs ?? DEFAULT_RUN_TUNING.offRouteSustainMs, 3000, 30000),
    offRouteAlertCooldownMs: clamp(input?.offRouteAlertCooldownMs ?? DEFAULT_RUN_TUNING.offRouteAlertCooldownMs, 10000, 300000),
  };
}

export function loadRunTuning(): RunTuning {
  if (typeof window === "undefined") return DEFAULT_RUN_TUNING;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RUN_TUNING;
    const parsed = JSON.parse(raw) as Partial<RunTuning>;
    return normalizeRunTuning(parsed);
  } catch {
    return DEFAULT_RUN_TUNING;
  }
}

export function saveRunTuning(tuning: RunTuning): RunTuning {
  const normalized = normalizeRunTuning(tuning);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}
