"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useGeolocation, calcDistance } from "@/hooks/useGeolocation";
import { useNotification } from "@/hooks/useNotification";
import { formatDuration, formatPace, calcPace } from "@/lib/utils";
import type { LatLng, ActivityType } from "@/types";

const KakaoMap = dynamic(() => import("@/components/KakaoMap"), { ssr: false });

const ARRIVAL_RADIUS_KM = 0.05; // 50m

interface RunConfig {
  startPoint: LatLng;
  endPoint: LatLng;
  activityType: ActivityType;
}

export default function RunningPage() {
  const router = useRouter();
  const [config, setConfig] = useState<RunConfig | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [arrived, setArrived] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arrivedRef = useRef(false);

  const { permission, requestPermission } = useNotification();
  const { position, startTracking, stopTracking, pathPoints, totalDistance, isTracking } =
    useGeolocation();

  useEffect(() => {
    const raw = sessionStorage.getItem("runConfig");
    if (!raw) {
      router.replace("/");
      return;
    }
    const parsed: RunConfig = JSON.parse(raw);
    setConfig(parsed);

    requestPermission();
    startTracking();

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopTracking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // permission 변수 사용 (lint 경고 방지)
  void permission;

  // 도착 감지
  useEffect(() => {
    if (!position || !config?.endPoint || arrivedRef.current) return;
    const dist = calcDistance(position, config.endPoint);
    if (dist <= ARRIVAL_RADIUS_KM) {
      arrivedRef.current = true;
      setArrived(true);
      sendArrivalNotification();
    }
  }, [position, config]);

  function sendArrivalNotification() {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("목적지 도착!", {
        body: "50m 이내에 진입했습니다.",
        icon: "/icons/icon-192x192.png",
      });
    }
  }

  const handleFinish = useCallback(() => {
    if (!config) return;
    stopTracking();
    if (timerRef.current) clearInterval(timerRef.current);

    sessionStorage.setItem(
      "runResult",
      JSON.stringify({
        startPoint: config.startPoint,
        endPoint: config.endPoint,
        distance_km: totalDistance,
        duration_seconds: elapsed,
        pace: calcPace(totalDistance, elapsed),
        activity_type: config.activityType,
      })
    );
    router.push("/result");
  }, [config, totalDistance, elapsed, stopTracking, router]);

  const pace = calcPace(totalDistance, elapsed);

  if (!config) return null;

  return (
    <main className="flex flex-col h-screen bg-gray-900 text-white">
      {/* 상단 스탯 */}
      <div className="bg-gray-900 px-4 pt-safe-top pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">
            {config.activityType === "running" ? "🏃" : "🚶"}
          </span>
          <span className="font-semibold text-gray-300 text-sm">
            {config.activityType === "running" ? "러닝" : "워킹"} 중
          </span>
          {isTracking && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              GPS 추적 중
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="거리" value={`${totalDistance.toFixed(2)}`} unit="km" />
          <StatCard label="시간" value={formatDuration(elapsed)} unit="" />
          <StatCard label="페이스" value={formatPace(pace)} unit="/km" />
        </div>
      </div>

      {/* 지도 */}
      <div className="flex-1 relative">
        <KakaoMap
          center={position ?? config.startPoint}
          startPoint={config.startPoint}
          endPoint={config.endPoint}
          currentPosition={position}
          pathPoints={pathPoints}
          showArrivalRadius
          className="h-full"
        />

        {arrived && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white text-gray-900 rounded-2xl p-6 mx-4 text-center shadow-xl">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-xl font-bold mb-1">도착!</p>
              <p className="text-sm text-gray-500 mb-4">목적지 50m 이내 진입</p>
              <button
                onClick={handleFinish}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
              >
                결과 보기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="bg-gray-900 px-4 py-4">
        <button
          onClick={handleFinish}
          className="w-full py-4 bg-red-500 rounded-xl font-bold text-lg active:bg-red-600"
        >
          종료
        </button>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold leading-none">
        {value}
        {unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
