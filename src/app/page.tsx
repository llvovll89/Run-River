"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { LatLng, ActivityType } from "@/types";

const KakaoMap = dynamic(() => import("@/components/KakaoMap"), { ssr: false });

type PointMode = "start" | "end" | null;

export default function Home() {
  const router = useRouter();
  const [startPoint, setStartPoint] = useState<LatLng | null>(null);
  const [endPoint, setEndPoint] = useState<LatLng | null>(null);
  const [mode, setMode] = useState<PointMode>("start");
  const [activityType, setActivityType] = useState<ActivityType>("running");
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }, []);

  function handleMapClick(latlng: LatLng) {
    if (mode === "start") {
      setStartPoint(latlng);
      setMode("end");
    } else if (mode === "end") {
      setEndPoint(latlng);
      setMode(null);
    }
  }

  function handleReset() {
    setStartPoint(null);
    setEndPoint(null);
    setMode("start");
  }

  function handleStart() {
    if (!startPoint || !endPoint) return;
    sessionStorage.setItem(
      "runConfig",
      JSON.stringify({ startPoint, endPoint, activityType })
    );
    router.push("/running");
  }

  const statusText = () => {
    if (!startPoint) return "지도를 클릭하여 출발 포인트를 선택하세요";
    if (!endPoint) return "지도를 클릭하여 도착 포인트를 선택하세요";
    return "출발 준비 완료!";
  };

  const canStart = startPoint && endPoint;

  return (
    <main className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <span className="text-2xl">🏃</span>
        <h1 className="text-xl font-bold">Run River</h1>
      </header>

      {/* 지도 */}
      <div className="flex-1 relative">
        <KakaoMap
          center={userLocation ?? { lat: 37.5665, lng: 126.978 }}
          onMapClick={handleMapClick}
          startPoint={startPoint}
          endPoint={endPoint}
          currentPosition={userLocation}
          className="h-full"
        />

        {/* 상태 안내 배너 */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow text-sm font-medium text-gray-700 whitespace-nowrap">
          {statusText()}
        </div>
      </div>

      {/* 하단 패널 */}
      <div className="bg-white shadow-lg rounded-t-2xl px-4 py-4 space-y-3">
        {/* 활동 타입 선택 */}
        <div className="flex gap-2">
          <button
            onClick={() => setActivityType("running")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
              activityType === "running"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            🏃 러닝
          </button>
          <button
            onClick={() => setActivityType("walking")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
              activityType === "walking"
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            🚶 워킹
          </button>
        </div>

        {/* 포인트 정보 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div
            className={`p-2 rounded-lg border-2 ${
              mode === "start"
                ? "border-blue-400 bg-blue-50"
                : startPoint
                ? "border-blue-200 bg-blue-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <p className="font-semibold text-gray-600">출발</p>
            <p className="text-gray-400 truncate">
              {startPoint
                ? `${startPoint.lat.toFixed(5)}, ${startPoint.lng.toFixed(5)}`
                : "미설정"}
            </p>
          </div>
          <div
            className={`p-2 rounded-lg border-2 ${
              mode === "end"
                ? "border-red-400 bg-red-50"
                : endPoint
                ? "border-red-200 bg-red-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <p className="font-semibold text-gray-600">도착</p>
            <p className="text-gray-400 truncate">
              {endPoint
                ? `${endPoint.lat.toFixed(5)}, ${endPoint.lng.toFixed(5)}`
                : "미설정"}
            </p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          {(startPoint || endPoint) && (
            <button
              onClick={handleReset}
              className="px-4 py-3 bg-gray-100 rounded-xl text-gray-600 text-sm font-semibold"
            >
              초기화
            </button>
          )}
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`flex-1 py-3 rounded-xl text-white font-bold text-base transition ${
              canStart
                ? activityType === "running"
                  ? "bg-blue-600 active:bg-blue-700"
                  : "bg-green-500 active:bg-green-600"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {canStart ? "출발!" : "포인트를 설정하세요"}
          </button>
        </div>
      </div>
    </main>
  );
}
