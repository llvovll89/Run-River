"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useGeolocation, calcDistance } from "@/hooks/useGeolocation";
import { useNotification } from "@/hooks/useNotification";
import { formatDuration, formatPace, calcPace } from "@/lib/utils";
import type { LatLng, ActivityType } from "@/types";

const KakaoMap = dynamic(() => import("@/components/KakaoMap"), { ssr: false });

interface RunConfig {
  startPoint: LatLng;
  endPoint: LatLng;
  activityType: ActivityType;
}

export default function RunningPage() {
  const router = useRouter();
  const [config, setConfig]   = useState<RunConfig | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [arrived, setArrived] = useState(false);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const arrivedRef = useRef(false);

  const { permission, requestPermission } = useNotification();
  const { position, startTracking, stopTracking, pathPoints, totalDistance, isTracking } =
    useGeolocation();

  void permission;

  useEffect(() => {
    const raw = sessionStorage.getItem("runConfig");
    if (!raw) { router.replace("/"); return; }
    const parsed: RunConfig = JSON.parse(raw);
    setConfig(parsed);
    requestPermission();
    startTracking();
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopTracking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!position || !config?.endPoint || arrivedRef.current) return;
    if (calcDistance(position, config.endPoint) <= 0.05) {
      arrivedRef.current = true;
      setArrived(true);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("목적지 도착!", {
          body: "50m 이내 진입",
          icon: "/icons/icon-192x192.png",
        });
      }
    }
  }, [position, config]);

  const handleFinish = useCallback(() => {
    if (!config) return;
    stopTracking();
    if (timerRef.current) clearInterval(timerRef.current);
    sessionStorage.setItem("runResult", JSON.stringify({
      startPoint: config.startPoint,
      endPoint: config.endPoint,
      distance_km: totalDistance,
      duration_seconds: elapsed,
      pace: calcPace(totalDistance, elapsed),
      activity_type: config.activityType,
    }));
    router.push("/result");
  }, [config, totalDistance, elapsed, stopTracking, router]);

  if (!config) return null;

  const isRun  = config.activityType === "running";
  const accent = isRun ? "var(--c-toss-blue)" : "var(--c-walk)";
  const pace   = calcPace(totalDistance, elapsed);

  return (
    <main className="relative w-full h-dvh overflow-hidden" style={{ background: "#0a0b0c" }}>
      <KakaoMap
        center={position ?? config.startPoint}
        startPoint={config.startPoint}
        endPoint={config.endPoint}
        currentPosition={position}
        pathPoints={pathPoints}
        showArrivalRadius
        className="absolute inset-0 h-full"
      />

      {/* 상단 스탯 */}
      <div
        className="absolute top-0 left-0 right-0 z-10"
        style={{
          paddingTop: "calc(var(--sat) + 14px)",
          paddingBottom: "16px",
          background: "rgba(10,11,12,0.82)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="px-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: `${accent}22`, color: accent, letterSpacing: "-0.01em" }}
              >
                {isRun ? "러닝" : "워킹"} 중
              </span>
            </div>
            {isTracking && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(52,199,89,0.15)" }}>
                <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "#34c759" }} />
                <span className="text-xs font-semibold" style={{ color: "#34c759" }}>GPS</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <RunStat label="거리"  value={totalDistance.toFixed(2)} unit="km"  accent={accent} large />
            <RunStat label="시간"  value={formatDuration(elapsed)}  unit=""    accent={accent} large />
            <RunStat label="페이스" value={formatPace(pace)}        unit="/km" accent={accent} />
          </div>
        </div>
      </div>

      {/* 도착 모달 */}
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
              도착!
            </h2>
            <p className="text-center mb-6" style={{ fontSize: 14, color: "#9da1a6" }}>목적지 50m 이내 진입</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              <MiniStat label="거리" value={`${totalDistance.toFixed(2)}`} unit="km" accent={accent} />
              <MiniStat label="시간" value={formatDuration(elapsed)} unit="" accent={accent} />
            </div>
            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-2xl font-bold text-base text-white"
              style={{ background: accent, boxShadow: `0 4px 20px ${accent}44`, letterSpacing: "-0.01em" }}
            >
              결과 보기
            </button>
          </div>
        </div>
      )}

      {/* 하단 종료 버튼 */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 px-5"
        style={{
          paddingBottom: "calc(var(--sab) + 20px)",
          paddingTop: "16px",
          background: "linear-gradient(to top, rgba(10,11,12,0.95) 60%, transparent)",
        }}
      >
        <button
          onClick={handleFinish}
          className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
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
    </main>
  );
}

function RunStat({ label, value, unit, accent, large = false }: {
  label: string; value: string; unit: string; accent: string; large?: boolean;
}) {
  return (
    <div
      className="rounded-2xl px-3 py-3 text-center"
      style={{ background: "rgba(26,28,31,0.9)", border: "1px solid rgba(255,255,255,0.08)" }}
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
