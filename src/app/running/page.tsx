"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useGeolocation, calcDistance } from "@/hooks/useGeolocation";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useCompass } from "@/hooks/useCompass";
import { useNotification } from "@/hooks/useNotification";
import { formatDuration, formatPace, calcPace, getPaceZone, getPaceGuidance } from "@/lib/utils";
import type { LatLng, ActivityType, TrackPoint, RunConfig, RunRecoverySnapshot } from "@/types";

const KakaoMap = dynamic(() => import("@/components/KakaoMap"), { ssr: false });

const RUN_RECOVERY_KEY = "runInProgress";
const RUN_RECOVERY_MAX_AGE_MS = 1000 * 60 * 60 * 6;

export default function RunningPage() {
  const router = useRouter();
  const [config, setConfig] = useState<RunConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [arrived, setArrived] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arrivedRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const startTimeRef = useRef<number>(0);
  const baseElapsedRef = useRef<number>(0);
  const isPausedRef = useRef(false);

  const { permission, requestPermission } = useNotification();
  const { profile } = useUserProfile();
  const {
    position,
    error: gpsError,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    pathPoints,
    trackPoints,
    totalDistance,
    speed,
    isTracking,
    currentAltitude,
    startAltitude,
    endAltitude,
    elevationGain,
    elevationLoss,
  } =
    useGeolocation();

  const [isPaused, setIsPaused] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<RunRecoverySnapshot | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 인터벌 트레이닝 state
  const [intervalPhase, setIntervalPhase] = useState<"run" | "rest">("run");
  const [intervalSet, setIntervalSet] = useState(1);
  const [intervalCountdown, setIntervalCountdown] = useState(0);
  const intervalPhaseRef = useRef<"run" | "rest">("run");
  const intervalSetRef = useRef(1);
  const intervalCountdownRef = useRef(0);
  const intervalRunSecondsRef = useRef(0);
  const intervalRestSecondsRef = useRef(0);
  const intervalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const saveRecoverySnapshot = useCallback((payload: Omit<RunRecoverySnapshot, "version" | "updatedAt">) => {
    try {
      const snapshot: RunRecoverySnapshot = {
        version: 1,
        updatedAt: Date.now(),
        ...payload,
      };
      sessionStorage.setItem(RUN_RECOVERY_KEY, JSON.stringify(snapshot));
    } catch {
      // Safari private mode 등 저장 실패는 무시
    }
  }, []);

  const clearRecoverySnapshot = useCallback(() => {
    sessionStorage.removeItem(RUN_RECOVERY_KEY);
  }, []);

  const acquireWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // 배터리 부족 등 — 무시
    }
  }, []);

  const beginSession = useCallback((
    nextConfig: RunConfig,
    recovery?: Pick<RunRecoverySnapshot, "elapsed" | "isPaused" | "pathPoints" | "trackPoints" | "totalDistance" | "currentAltitude" | "startAltitude" | "endAltitude" | "elevationGain" | "elevationLoss">
  ) => {
    setConfig(nextConfig);
    requestPermission();
    startTracking({
      activityType: nextConfig.activityType,
      restore: recovery
        ? {
          pathPoints: recovery.pathPoints,
          trackPoints: recovery.trackPoints,
          totalDistance: recovery.totalDistance,
          currentAltitude: recovery.currentAltitude,
          startAltitude: recovery.startAltitude,
          endAltitude: recovery.endAltitude,
          elevationGain: recovery.elevationGain,
          elevationLoss: recovery.elevationLoss,
        }
        : undefined,
    });
    void acquireWakeLock();

    startTimeRef.current = Date.now();
    baseElapsedRef.current = recovery?.elapsed ?? 0;
    setElapsed(recovery?.elapsed ?? 0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recovery?.isPaused) {
      pauseTracking();
      isPausedRef.current = true;
      setIsPaused(true);
    } else {
      isPausedRef.current = false;
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor(baseElapsedRef.current + (Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
  }, [requestPermission, startTracking, acquireWakeLock, pauseTracking]);

  const { heading, needsPermission, requestPermission: requestCompassPermission } = useCompass();

  void permission;

  // GPS 오류 토스트
  useEffect(() => {
    if (gpsError) showToast(`GPS 오류: ${gpsError}`);
  }, [gpsError, showToast]);

  useEffect(() => {
    let parsedConfig: RunConfig | null = null;

    const raw = sessionStorage.getItem("runConfig");
    if (raw) {
      try {
        parsedConfig = JSON.parse(raw) as RunConfig;
        beginSession(parsedConfig);
      } catch {
        sessionStorage.removeItem("runConfig");
        showToast("설정 데이터가 손상되었습니다. 다시 설정해주세요.");
        router.replace("/");
        return;
      }
    } else {
      const rawRecovery = sessionStorage.getItem(RUN_RECOVERY_KEY);
      if (rawRecovery) {
        try {
          const parsedRecovery = JSON.parse(rawRecovery) as Partial<RunRecoverySnapshot>;
          const hasRequiredFields =
            parsedRecovery.version === 1 &&
            typeof parsedRecovery.updatedAt === "number" &&
            parsedRecovery.config !== undefined &&
            typeof parsedRecovery.elapsed === "number" &&
            typeof parsedRecovery.isPaused === "boolean" &&
            typeof parsedRecovery.totalDistance === "number" &&
            Array.isArray(parsedRecovery.pathPoints);
          const updatedAt = typeof parsedRecovery.updatedAt === "number" ? parsedRecovery.updatedAt : null;
          const isFresh = hasRequiredFields && updatedAt !== null && Date.now() - updatedAt <= RUN_RECOVERY_MAX_AGE_MS;
          if (isFresh) {
            const normalizedRecovery: RunRecoverySnapshot = {
              ...parsedRecovery,
              currentAltitude: parsedRecovery.currentAltitude ?? null,
              startAltitude: parsedRecovery.startAltitude ?? null,
              endAltitude: parsedRecovery.endAltitude ?? null,
              elevationGain: parsedRecovery.elevationGain ?? 0,
              elevationLoss: parsedRecovery.elevationLoss ?? 0,
              trackPoints: parsedRecovery.trackPoints ?? [],
            } as RunRecoverySnapshot;
            setConfig(normalizedRecovery.config);
            setPendingRecovery(normalizedRecovery);
            return;
          }
        } catch {
          clearRecoverySnapshot();
        }
      }
    }

    if (!parsedConfig && !raw) {
      setConfigError(true);
      setTimeout(() => router.replace("/"), 2000);
      return;
    }

    // iOS는 Wake Lock 미지원 → 화면 꺼지면 GPS 중단됨 안내
    if (!("wakeLock" in navigator)) {
      setTimeout(() => showToast("화면이 꺼지면 GPS 추적이 중단돼요. 화면을 켜두세요."), 1500);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      stopTracking();
      wakeLockRef.current?.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginSession, clearRecoverySnapshot, router, showToast, stopTracking]);

  const handleResumeRecoveredSession = useCallback(() => {
    if (!pendingRecovery) return;
    setPendingRecovery(null);
    beginSession(pendingRecovery.config, {
      elapsed: pendingRecovery.elapsed,
      isPaused: pendingRecovery.isPaused,
      pathPoints: pendingRecovery.pathPoints,
      trackPoints: pendingRecovery.trackPoints,
      totalDistance: pendingRecovery.totalDistance,
      currentAltitude: pendingRecovery.currentAltitude,
      startAltitude: pendingRecovery.startAltitude,
      endAltitude: pendingRecovery.endAltitude,
      elevationGain: pendingRecovery.elevationGain,
      elevationLoss: pendingRecovery.elevationLoss,
    });
    showToast("이전 러닝 세션을 복구했어요.");
  }, [pendingRecovery, beginSession, showToast]);

  const handleDiscardRecoveredSession = useCallback(() => {
    clearRecoverySnapshot();
    sessionStorage.removeItem("runConfig");
    setPendingRecovery(null);
    router.replace("/");
  }, [clearRecoverySnapshot, router]);

  useEffect(() => {
    if (!config || arrived || pendingRecovery) return;

    const persist = () => {
      const liveElapsed = Math.floor(
        baseElapsedRef.current + (isPausedRef.current ? 0 : (Date.now() - startTimeRef.current) / 1000)
      );
      saveRecoverySnapshot({
        config,
        elapsed: liveElapsed,
        isPaused: isPausedRef.current,
        totalDistance,
        pathPoints,
        trackPoints,
        currentAltitude,
        startAltitude,
        endAltitude,
        elevationGain,
        elevationLoss,
      });
    };

    persist();
    const saveTimer = setInterval(persist, 3000);
    const onPageHide = () => persist();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(saveTimer);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [
    config,
    totalDistance,
    pathPoints,
    trackPoints,
    currentAltitude,
    startAltitude,
    endAltitude,
    elevationGain,
    elevationLoss,
    arrived,
    pendingRecovery,
    saveRecoverySnapshot,
  ]);

  // Wake Lock은 페이지 숨김 시 자동 해제됨 → 복귀 시 재획득 + 중단 시간 안내
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        if (!isPausedRef.current) acquireWakeLock();
        if (hiddenAtRef.current) {
          const secs = Math.round((Date.now() - hiddenAtRef.current) / 1000);
          hiddenAtRef.current = null;
          if (secs >= 3) showToast(`화면이 ${secs}초 꺼져 있었어요. 이 구간은 추적되지 않았어요.`);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [acquireWakeLock, showToast]);

  // 도착지 도착 감지 (지도 모드)
  useEffect(() => {
    if (!position || !config?.endPoint || arrivedRef.current) return;
    if (calcDistance(position, config.endPoint) <= 0.005) {
      arrivedRef.current = true;
      setArrived(true);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("목적지 도착!", {
          body: "5m 이내 진입",
          icon: "/icons/icon-192x192.png",
        });
      }
    }
  }, [position, config]);

  // 목표 거리 달성 감지 (거리 목표 모드)
  useEffect(() => {
    if (!config?.goalDistance || arrivedRef.current) return;
    if (totalDistance >= config.goalDistance) {
      arrivedRef.current = true;
      setArrived(true);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("목표 달성!", {
          body: `${config.goalDistance}km 완주`,
          icon: "/icons/icon-192x192.png",
        });
      }
    }
  }, [totalDistance, config]);

  // 목표 시간 달성 감지 (시간 목표 모드)
  useEffect(() => {
    if (!config?.goalTime || arrivedRef.current) return;
    if (elapsed >= config.goalTime * 60) {
      arrivedRef.current = true;
      setArrived(true);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("시간 목표 달성!", {
          body: `${config.goalTime}분 완료 · ${totalDistance.toFixed(2)}km 달림`,
          icon: "/icons/icon-192x192.png",
        });
      }
    }
  }, [elapsed, config, totalDistance]);

  const handleFinish = useCallback(() => {
    if (!config) return;
    stopTracking();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    wakeLockRef.current?.release();
    const finalElapsed = Math.floor(
      baseElapsedRef.current + (isPausedRef.current ? 0 : (Date.now() - startTimeRef.current) / 1000)
    );
    sessionStorage.setItem("runResult", JSON.stringify({
      startPoint: config.startPoint,
      endPoint: config.endPoint,
      distance_km: totalDistance,
      duration_seconds: finalElapsed,
      pace: calcPace(totalDistance, finalElapsed),
      activity_type: config.activityType,
      pathPoints,
      trackPoints,
      altitude_start_m: startAltitude,
      altitude_end_m: endAltitude,
      elevation_gain_m: elevationGain,
      elevation_loss_m: elevationLoss,
      ...(config.intervalPreset && {
        intervalPreset: config.intervalPreset,
        intervalCompletedSets: intervalSetRef.current,
        intervalTotalRunSeconds: intervalRunSecondsRef.current,
        intervalTotalRestSeconds: intervalRestSecondsRef.current,
      }),
    }));
    clearRecoverySnapshot();
    sessionStorage.removeItem("runConfig");
    router.push("/result");
  }, [
    config,
    totalDistance,
    pathPoints,
    trackPoints,
    startAltitude,
    endAltitude,
    elevationGain,
    elevationLoss,
    stopTracking,
    router,
    clearRecoverySnapshot,
  ]);

  const handlePause = useCallback(() => {
    pauseTracking();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    baseElapsedRef.current += (Date.now() - startTimeRef.current) / 1000;
    isPausedRef.current = true;
    setIsPaused(true);
  }, [pauseTracking]);

  const handleResume = useCallback(() => {
    resumeTracking();
    startTimeRef.current = Date.now();
    isPausedRef.current = false;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor(baseElapsedRef.current + (Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    setIsPaused(false);
  }, [resumeTracking]);

  // 인터벌 preset 설정 시 초기화
  useEffect(() => {
    if (!config?.intervalPreset || config.intervalPreset.sets === 0) return;
    const cd = config.intervalPreset.runSeconds;
    intervalCountdownRef.current = cd;
    intervalPhaseRef.current = "run";
    intervalSetRef.current = 1;
    setIntervalCountdown(cd);
    setIntervalPhase("run");
    setIntervalSet(1);
  }, [config]);

  // 인터벌 tick (pause/tracking 상태에 따라 타이머 on/off)
  useEffect(() => {
    if (!config?.intervalPreset || isPaused || !isTracking) {
      if (intervalTimerRef.current) { clearInterval(intervalTimerRef.current); intervalTimerRef.current = null; }
      return;
    }
    const preset = config.intervalPreset;

    intervalTimerRef.current = setInterval(() => {
      if (intervalPhaseRef.current === "run") intervalRunSecondsRef.current += 1;
      else intervalRestSecondsRef.current += 1;

      if (preset.sets === 0) {
        // 파틀렉: 카운트업
        intervalCountdownRef.current += 1;
        setIntervalCountdown((prev) => prev + 1);
        return;
      }

      const next = intervalCountdownRef.current - 1;
      if (next <= 0) {
        if (intervalPhaseRef.current === "run") {
          intervalPhaseRef.current = "rest";
          intervalCountdownRef.current = preset.restSeconds;
          setIntervalPhase("rest");
          setIntervalCountdown(preset.restSeconds);
          if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
        } else {
          const nextSet = intervalSetRef.current + 1;
          if (nextSet > preset.sets) {
            clearInterval(intervalTimerRef.current!);
            intervalTimerRef.current = null;
            setIntervalCountdown(0);
            setArrived(true);
            arrivedRef.current = true;
          } else {
            intervalSetRef.current = nextSet;
            intervalPhaseRef.current = "run";
            intervalCountdownRef.current = preset.runSeconds;
            setIntervalSet(nextSet);
            setIntervalPhase("run");
            setIntervalCountdown(preset.runSeconds);
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
          }
        }
      } else {
        intervalCountdownRef.current = next;
        setIntervalCountdown(next);
      }
    }, 1000);

    return () => { if (intervalTimerRef.current) { clearInterval(intervalTimerRef.current); intervalTimerRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, isTracking, config?.intervalPreset]);

  // Auto-pause: 3초 이상 정지(speed < 0.5 m/s) 감지 시 자동 일시정지
  useEffect(() => {
    if (!profile.autoPause || isPaused || !isTracking) {
      clearTimeout(autoPauseTimerRef.current!);
      autoPauseTimerRef.current = null;
      return;
    }
    const stopped = speed !== null && speed < 0.5;
    if (stopped) {
      if (!autoPauseTimerRef.current) {
        autoPauseTimerRef.current = setTimeout(() => {
          autoPauseTimerRef.current = null;
          handlePause();
          showToast("자동으로 일시정지됨");
        }, 3000);
      }
    } else {
      clearTimeout(autoPauseTimerRef.current!);
      autoPauseTimerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, isPaused, isTracking, profile.autoPause]);

  if (!config) {
    if (configError) {
      return (
        <main className="min-h-dvh flex items-center justify-center" style={{ background: "#0a0b0c" }}>
          <div className="text-center px-6">
            <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8 }}>설정 정보가 없어요</p>
            <p style={{ fontSize: 13, color: "#5e636a" }}>홈으로 돌아갑니다…</p>
          </div>
        </main>
      );
    }
    return null;
  }

  const isRun = config.activityType === "running";
  const accent = isRun ? "var(--c-toss-blue)" : "var(--c-walk)";
  const pace = calcPace(totalDistance, elapsed);
  const paceZone = getPaceZone(pace, config.activityType);
  const paceGuide = getPaceGuidance(pace, config.activityType);

  return (
    <main className="relative w-full h-dvh overflow-hidden" style={{ background: "#0a0b0c" }}>
      <KakaoMap
        center={position ?? config.startPoint}
        startPoint={config.startPoint}
        endPoint={config.endPoint}
        currentPosition={position}
        heading={heading}
        pathPoints={pathPoints}
        showArrivalRadius
        activityType={config.activityType}
        followUser={followUser}
        onUserDrag={() => setFollowUser(false)}
        className="absolute inset-0 h-full"
      />

      {/* 내 위치 재중심 버튼 (지도 수동 이동 후 표시) */}
      {!followUser && (
        <button
          onClick={() => setFollowUser(true)}
          className="absolute z-10 flex items-center gap-1.5 px-3 py-2 rounded-full active:scale-95 transition-transform"
          style={{
            right: 16,
            bottom: "calc(var(--sab) + 100px)",
            background: "rgba(20,22,26,0.9)",
            border: `1px solid ${accent}55`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: accent,
            fontSize: 12,
            fontWeight: 700,
            boxShadow: `0 2px 12px ${accent}33`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="8" />
          </svg>
          내 위치
        </button>
      )}

      {/* GPS 중단 토스트 */}
      {toast && (
        <div
          className="absolute z-30 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-2xl"
          style={{
            top: "calc(var(--sat) + 80px)",
            background: "rgba(30,30,32,0.95)",
            border: "1px solid rgba(255,159,10,0.4)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            color: "#ff9f0a",
            fontSize: 13,
            fontWeight: 600,
            maxWidth: "calc(100vw - 32px)",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            whiteSpace: "pre-wrap",
          }}
        >
          {toast}
        </div>
      )}

      {/* 나침반 권한 요청 버튼 (iOS 13+만 필요) */}
      {needsPermission && (
        <button
          onClick={requestCompassPermission}
          className="absolute z-20 flex items-center gap-1.5 px-3 py-2 rounded-full active:scale-95 transition-transform"
          style={{
            right: 16,
            bottom: "calc(var(--sab) + 160px)",
            background: "rgba(20,22,26,0.9)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
          나침반 켜기
        </button>
      )}

      {/* 상단 스탯 */}
      <div
        className="absolute top-0 left-0 right-0 z-10"
        style={{
          paddingTop: "calc(var(--sat) + 14px)",
          paddingBottom: "16px",
          background: isPaused
            ? "rgba(10,11,12,0.88)"
            : isRun
              ? "rgba(0,20,50,0.88)"
              : "rgba(0,28,15,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${accent}33`,
          transition: "background 0.5s ease, border-color 0.5s ease",
        }}
      >
        <div className="px-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: `${accent}22`, color: accent, letterSpacing: "-0.01em" }}
              >
                {isPaused ? "⏸ 일시정지" : (isRun ? "🏃 러닝" : "🚶 워킹") + " 중"}
              </span>
              {/* 페이스존 밽지 */}
              {!isPaused && pace > 0 && (
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{
                    background: `${paceZone.color}22`,
                    color: paceZone.color,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {paceZone.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {isPaused ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,159,10,0.15)" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ff9f0a" }} />
                  <span className="text-xs font-semibold" style={{ color: "#ff9f0a" }}>일시정지</span>
                </div>
              ) : isTracking ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(52,199,89,0.15)" }}>
                  <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "#34c759" }} />
                  <span className="text-xs font-semibold" style={{ color: "#34c759" }}>GPS</span>
                </div>
              ) : null}
            </div>
          </div>
          {!isPaused && (
            <p className="mb-3" style={{ fontSize: 12, fontWeight: 600, color: paceZone.color }}>
              {paceGuide}
            </p>
          )}
          {currentAltitude !== null && (
            <p className="mb-3" style={{ fontSize: 12, color: "#9da1a6" }}>
              고도 {Math.round(currentAltitude)}m · 누적 상승 {Math.round(elevationGain)}m
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <RunStat label="거리" value={totalDistance.toFixed(2)} unit="km" accent={accent} large />
            <RunStat label="시간" value={formatDuration(elapsed)} unit="" accent={accent} large />
            <RunStat label="페이스" value={formatPace(pace)} unit="/km" accent={pace > 0 && !isPaused ? paceZone.color : accent} />
            <div
              className="rounded-2xl px-3 py-3 text-center"
              style={{
                background: `${accent}0d`,
                border: `1px solid ${accent}33`,
                boxShadow: `0 0 12px ${accent}18`,
                transition: "background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease",
              }}
            >
              <p style={{ fontSize: 11, color: "#5e636a", marginBottom: 4 }}>방위</p>
              <p className="num" style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
                {heading !== null ? toCardinal(heading) : "--"}
              </p>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                style={{
                  marginTop: 4,
                  transform: `rotate(${heading ?? 0}deg)`,
                  transition: "transform 0.3s ease",
                  opacity: heading !== null ? 1 : 0.25,
                  display: "inline-block",
                }}
              >
                <path d="M12 2L8 20l4-4 4 4L12 2Z" fill={accent} />
              </svg>
            </div>
          </div>
        </div>

        {/* 목표 거리 진행 바 */}
        {config.goalDistance && (
          <div className="px-5 pt-3">
            <div className="flex justify-between items-center mb-1.5">
              <span style={{ fontSize: 11, color: "#5e636a" }}>목표까지</span>
              <span className="num" style={{ fontSize: 11, fontWeight: 700, color: accent }}>
                {Math.max(0, config.goalDistance - totalDistance).toFixed(2)} km 남음
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.1)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (totalDistance / config.goalDistance) * 100)}%`,
                  background: accent,
                }}
              />
            </div>
          </div>
        )}

        {/* 목표 시간 진행 바 */}
        {config.goalTime && (
          <div className="px-5 pt-3">
            <div className="flex justify-between items-center mb-1.5">
              <span style={{ fontSize: 11, color: "#5e636a" }}>남은 시간</span>
              <span className="num" style={{ fontSize: 11, fontWeight: 700, color: accent }}>
                {formatDuration(Math.max(0, config.goalTime * 60 - elapsed))}
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.1)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (elapsed / (config.goalTime * 60)) * 100)}%`,
                  background: accent,
                }}
              />
            </div>
          </div>
        )}
      </div>
      {arrived && (
        <div
          className="absolute inset-0 z-20 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="w-full mx-0 px-5 pt-7 pb-8 slide-up"
            style={{
              background: "#121315",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "24px 24px 0 0",
            }}
          >
            <div className="flex justify-center mb-5">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
            </div>
            <h2
              className="mb-1 text-center"
              style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}
            >
              {config.goalDistance ? "목표 달성! 🎉" : config.goalTime ? "시간 목표 달성! 🎉" : "도착!"}
            </h2>
            <p className="text-center mb-6" style={{ fontSize: 14, color: "#9da1a6" }}>
              {config.goalDistance
                ? `${config.goalDistance}km 완주`
                : config.goalTime
                  ? `${config.goalTime}분 완료 · ${totalDistance.toFixed(2)}km 달림`
                  : "목적지 5m 이내 진입"}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              <MiniStat label="거리" value={`${totalDistance.toFixed(2)}`} unit="km" accent={accent} />
              <MiniStat label="시간" value={formatDuration(elapsed)} unit="" accent={accent} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { arrivedRef.current = false; setArrived(false); }}
                className="py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#d1d4d9",
                  border: "1px solid rgba(255,255,255,0.12)",
                  letterSpacing: "-0.01em",
                }}
              >
                계속 달리기
              </button>
              <button
                onClick={handleFinish}
                className="py-4 rounded-2xl font-bold text-base text-white active:scale-[0.98] transition-transform"
                style={{ background: accent, boxShadow: `0 4px 20px ${accent}44`, letterSpacing: "-0.01em" }}
              >
                결과 보기
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRecovery && (
        <div
          className="absolute inset-0 z-40 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="w-full mx-0 px-5 pt-7 pb-8 slide-up"
            style={{
              background: "#121315",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "24px 24px 0 0",
            }}
          >
            <div className="flex justify-center mb-5">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
            </div>
            <h2 className="mb-2 text-center" style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              러닝 기록을 찾았어요
            </h2>
            <p className="text-center mb-5" style={{ fontSize: 14, color: "#9da1a6" }}>
              {formatDuration(pendingRecovery.elapsed)} · {pendingRecovery.totalDistance.toFixed(2)}km
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDiscardRecoveredSession}
                className="py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#d1d4d9",
                  border: "1px solid rgba(255,255,255,0.12)",
                  letterSpacing: "-0.01em",
                }}
              >
                새로 시작
              </button>
              <button
                onClick={handleResumeRecoveredSession}
                className="py-4 rounded-2xl font-bold text-base text-white active:scale-[0.98] transition-transform"
                style={{
                  background: accent,
                  boxShadow: `0 4px 20px ${accent}44`,
                  letterSpacing: "-0.01em",
                }}
              >
                이어하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 버튼 */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 px-5"
        style={{
          paddingBottom: "calc(var(--sab) + 20px)",
          paddingTop: "16px",
          background: "linear-gradient(to top, rgba(10,11,12,0.95) 60%, transparent)",
        }}
      >
        {/* 인터벌 HUD */}
        {config.intervalPreset && (
          <div
            className="rounded-2xl px-4 py-3 mb-2"
            style={{
              background: intervalPhase === "run" ? "rgba(0,122,255,0.15)" : "rgba(52,199,89,0.15)",
              border: `1px solid ${intervalPhase === "run" ? "rgba(0,122,255,0.3)" : "rgba(52,199,89,0.3)"}`,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold" style={{ color: intervalPhase === "run" ? "var(--c-toss-blue)" : "var(--c-walk)" }}>
                {intervalPhase === "run" ? "⚡ 달리기" : "💤 휴식"}
              </span>
              {config.intervalPreset.sets > 0 && (
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {intervalSet}/{config.intervalPreset.sets}세트
                </span>
              )}
            </div>
            {config.intervalPreset.sets === 0 ? (
              <div className="flex items-center justify-between">
                <span className="font-bold num" style={{ fontSize: 28, color: "#fff", letterSpacing: "-0.03em" }}>
                  {Math.floor(intervalCountdown / 60).toString().padStart(2, "0")}:{(intervalCountdown % 60).toString().padStart(2, "0")}
                </span>
                <button
                  onClick={() => {
                    const next = intervalPhaseRef.current === "run" ? "rest" : "run";
                    intervalPhaseRef.current = next;
                    intervalCountdownRef.current = 0;
                    setIntervalPhase(next);
                    setIntervalCountdown(0);
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  {intervalPhase === "run" ? "→ 휴식" : "→ 달리기"}
                </button>
              </div>
            ) : (
              <>
                <span className="font-bold num" style={{ fontSize: 28, color: "#fff", letterSpacing: "-0.03em" }}>
                  {Math.floor(intervalCountdown / 60).toString().padStart(2, "0")}:{(intervalCountdown % 60).toString().padStart(2, "0")}
                </span>
                {config.intervalPreset.sets > 0 && (
                  <div className="mt-2 rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.1)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((intervalSet - 1) / config.intervalPreset.sets * 100)}%`,
                        background: intervalPhase === "run" ? "var(--c-toss-blue)" : "var(--c-walk)",
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={isPaused ? handleResume : handlePause}
            className="py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
            style={{
              background: isPaused ? "rgba(52,199,89,0.2)" : "rgba(255,159,10,0.2)",
              color: isPaused ? "#34c759" : "#ff9f0a",
              border: `1px solid ${isPaused ? "rgba(52,199,89,0.3)" : "rgba(255,159,10,0.3)"}`,
              letterSpacing: "-0.01em",
            }}
          >
            {isPaused ? "계속하기" : "일시정지"}
          </button>
          <button
            onClick={handleFinish}
            className="py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
            style={{
              background: "var(--c-danger)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(255,69,58,0.35)",
              letterSpacing: "-0.01em",
            }}
          >
            종료
          </button>
        </div>
      </div>
    </main>
  );
}

function toCardinal(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function RunStat({ label, value, unit, accent, large = false }: {
  label: string; value: string; unit: string; accent: string; large?: boolean;
}) {
  return (
    <div
      className="rounded-2xl px-3 py-3 text-center"
      style={{
        background: `${accent}0d`,
        border: `1px solid ${accent}33`,
        boxShadow: `0 0 12px ${accent}18`,
        transition: "background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease",
      }}
    >
      <p style={{ fontSize: 11, color: "#5e636a", marginBottom: 4 }}>{label}</p>
      <p
        className="num"
        style={{ fontSize: large ? 22 : 18, fontWeight: 800, color: accent, lineHeight: 1.1, letterSpacing: "-0.03em" }}
      >
        {value}
      </p>
      {unit && <p style={{ fontSize: 11, color: "#5e636a", marginTop: 2 }}>{unit}</p>}
    </div>
  );
}

function MiniStat({ label, value, unit, accent }: { label: string; value: string; unit: string; accent: string }) {
  return (
    <div
      className="rounded-2xl py-3 text-center"
      style={{ background: "rgba(26,28,31,0.9)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p style={{ fontSize: 11, color: "#9da1a6", marginBottom: 4 }}>{label}</p>
      <div className="flex items-baseline justify-center gap-0.5">
        <span className="num" style={{ fontSize: 20, fontWeight: 800, color: accent, letterSpacing: "-0.03em" }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: "#5e636a" }}>{unit}</span>}
      </div>
    </div>
  );
}
