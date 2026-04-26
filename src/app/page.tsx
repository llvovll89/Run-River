"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTheme } from "@/hooks/useTheme";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import Image from "next/image";
import type { LatLng, ActivityType } from "@/types";

const KakaoMap = dynamic(() => import("@/components/KakaoMap"), { ssr: false });

type PointMode = "start" | "end" | null;

export default function Home() {
  const router = useRouter();
  const [startPoint, setStartPoint] = useState<LatLng | null>(null);
  const [endPoint, setEndPoint]     = useState<LatLng | null>(null);
  const [mode, setMode]             = useState<PointMode>("start");
  const [activityType, setActivityType] = useState<ActivityType>("running");
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(true);
  const dragY   = useRef(0);
  const didDrag = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((p) =>
      setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude })
    );
  }, []);

  function handleMapClick(latlng: LatLng) {
    if (mode === "start") { setStartPoint(latlng); setMode("end"); }
    else if (mode === "end") { setEndPoint(latlng); setMode(null); }
  }

  function handleStart() {
    if (!startPoint || !endPoint) return;
    sessionStorage.setItem("runConfig", JSON.stringify({ startPoint, endPoint, activityType }));
    router.push("/running");
  }

  const { theme, toggle } = useTheme();
  const { browser, canInstall, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const canStart  = !!(startPoint && endPoint);
  const isRun     = activityType === "running";
  const accentVar = isRun ? "var(--c-toss-blue)" : "var(--c-walk)";

  const guide = !startPoint
    ? { text: "출발 지점을 탭하세요", color: "var(--c-toss-blue)" }
    : !endPoint
    ? { text: "도착 지점을 탭하세요", color: "#f59e0b" }
    : { text: "준비 완료 · 출발하세요", color: "var(--c-walk)" };

  return (
    <main className="relative w-full h-dvh overflow-hidden">
      <KakaoMap
        center={userLocation ?? { lat: 37.5665, lng: 126.978 }}
        onMapClick={handleMapClick}
        startPoint={startPoint}
        endPoint={endPoint}
        currentPosition={userLocation}
        className="absolute inset-0 h-full"
      />

      {/* 헤더 */}
      <div
        className="absolute top-0 left-0 right-0 z-10 px-4 flex items-center justify-between"
        style={{ paddingTop: "calc(var(--sat) + 12px)", paddingBottom: "12px" }}
      >
        <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2">
          <Image src="/icons/icon-192x192.png" alt="Run River" width={26} height={26} className="rounded-lg" />
          <span className="font-bold text-sm tracking-tight" style={{ color: "var(--c-text-1)" }}>
            Run River
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canInstall && (
            <button
              onClick={browser === "ios-safari" ? () => setShowIOSGuide(true) : promptInstall}
              className="glass rounded-2xl p-2.5 active:scale-95 transition-transform"
              aria-label="앱 설치"
            >
              <InstallIcon />
            </button>
          )}
          <button
            onClick={toggle}
            className="glass rounded-2xl p-2.5 active:scale-95 transition-transform"
            aria-label="테마 전환"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            onClick={() => router.push("/history")}
            className="glass rounded-2xl p-2.5 active:scale-95 transition-transform"
            aria-label="기록"
          >
            <HistoryIcon />
          </button>
        </div>
      </div>

      {/* 안내 pill */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        style={{ top: "calc(var(--sat) + 70px)" }}
      >
        <span
          className="text-xs font-semibold px-4 py-1.5 rounded-full whitespace-nowrap"
          style={{
            background: "rgba(10,11,12,0.72)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${guide.color}50`,
            color: guide.color,
          }}
        >
          {guide.text}
        </span>
      </div>

      {/* iOS 설치 안내 모달 */}
      {showIOSGuide && (
        <div
          className="absolute inset-0 z-50 flex items-end"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6 space-y-4"
            style={{ background: "var(--c-bg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-1 rounded-full mx-auto" style={{ background: "var(--c-border)" }} />
            <h3 className="text-base font-bold text-center" style={{ color: "var(--c-text-1)" }}>
              홈 화면에 추가
            </h3>
            <div className="space-y-3">
              <Step num={1} text="하단의 공유 버튼을 탭하세요" icon={<ShareIcon />} />
              <Step num={2} text="'홈 화면에 추가'를 선택하세요" icon={<AddBoxIcon />} />
              <Step num={3} text="오른쪽 상단 '추가'를 탭하세요" icon={<CheckIcon />} />
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm"
              style={{ background: "var(--c-elevated)", color: "var(--c-text-2)" }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 z-10 sheet"
        style={{
          paddingBottom: "calc(var(--sab) + 16px)",
          transform: sheetOpen ? "translateY(0)" : "translateY(calc(100% - 36px))",
          transition: "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* 드래그 핸들 */}
        <div
          className="flex justify-center pt-3 pb-3 cursor-pointer select-none"
          onClick={() => { if (!didDrag.current) setSheetOpen((o) => !o); didDrag.current = false; }}
          onTouchStart={(e) => {
            didDrag.current = false;
            dragY.current = e.touches[0].clientY;
            const el = sheetRef.current;
            if (el) el.style.transition = "none";
          }}
          onTouchMove={(e) => {
            const el = sheetRef.current;
            if (!el) return;
            const dy = e.touches[0].clientY - dragY.current;
            if (Math.abs(dy) > 5) didDrag.current = true;
            const baseY = sheetOpen ? 0 : el.offsetHeight - 36;
            const next = Math.max(0, baseY + dy);
            el.style.transform = `translateY(${next}px)`;
          }}
          onTouchEnd={(e) => {
            const el = sheetRef.current;
            if (!el) return;
            el.style.transition = "";
            const dy = e.changedTouches[0].clientY - dragY.current;
            if (dy > 60) setSheetOpen(false);
            else if (dy < -40) setSheetOpen(true);
            else el.style.transform = sheetOpen ? "translateY(0)" : "translateY(calc(100% - 36px))";
          }}
        >
          <div className="w-8 h-1 rounded-full" style={{ background: "var(--c-border)" }} />
        </div>

        <div className="px-4 space-y-3">
          {/* 활동 유형 */}
          <div className="card flex gap-2 p-1 rounded-2xl" style={{ background: "var(--c-elevated)" }}>
            {(["running", "walking"] as ActivityType[]).map((t) => {
              const active = activityType === t;
              const color  = t === "running" ? "var(--c-toss-blue)" : "var(--c-walk)";
              return (
                <button
                  key={t}
                  onClick={() => setActivityType(t)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
                  style={{
                    background: active ? color : "transparent",
                    color: active ? "#fff" : "var(--c-text-2)",
                    boxShadow: active ? `0 2px 14px ${color}44` : "none",
                  }}
                >
                  {t === "running" ? <RunIcon /> : <WalkIcon />}
                  <span>{t === "running" ? "러닝" : "워킹"}</span>
                </button>
              );
            })}
          </div>

          {/* 포인트 카드 */}
          <div className="grid grid-cols-2 gap-2">
            <PointCard
              label="출발" point={startPoint}
              active={mode === "start"} color="var(--c-toss-blue)"
            />
            <PointCard
              label="도착" point={endPoint}
              active={mode === "end"}   color="#f59e0b"
            />
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            {(startPoint || endPoint) && (
              <button
                onClick={() => { setStartPoint(null); setEndPoint(null); setMode("start"); }}
                className="px-5 py-4 rounded-2xl text-sm font-semibold active:scale-95 transition-transform"
                style={{
                  background: "var(--c-elevated)",
                  border: "1px solid var(--c-border)",
                  color: "var(--c-text-2)",
                }}
              >
                초기화
              </button>
            )}
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="flex-1 py-4 rounded-2xl font-bold text-base transition-all duration-200 active:scale-[0.98]"
              style={{
                background: canStart ? accentVar : "var(--c-elevated)",
                border: canStart ? "none" : "1px solid var(--c-border)",
                color: canStart ? "#fff" : "var(--c-text-3)",
                boxShadow: canStart ? `0 4px 20px ${accentVar}44` : "none",
                letterSpacing: "-0.01em",
              }}
            >
              {canStart ? "출발하기" : "포인트를 설정하세요"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function PointCard({
  label, point, active, color,
}: {
  label: string; point: LatLng | null; active: boolean; color: string;
}) {
  const isStart = label === "출발";
  return (
    <div
      className={`rounded-2xl px-3 py-2.5 transition-all${active ? "" : " card"}`}
      style={active ? {
        background: `${color}12`,
        border: `1px solid ${color}55`,
      } : undefined}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: isStart ? "var(--c-toss-blue)" : "#f59e0b" }}
        />
        <span className="text-xs font-semibold" style={{ color: "var(--c-text-2)" }}>{label}</span>
        {active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: color }} />
        )}
      </div>
      <p className="text-xs num truncate" style={{ color: point ? "var(--c-text-1)" : "var(--c-text-3)", fontWeight: point ? 600 : 400 }}>
        {point ? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` : "미설정"}
      </p>
    </div>
  );
}

function Step({ num, text, icon }: { num: number; text: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: "var(--c-toss-blue)", color: "#fff" }}
      >
        {num}
      </span>
      <span className="flex-1 text-sm" style={{ color: "var(--c-text-1)" }}>{text}</span>
      <span style={{ color: "var(--c-text-2)" }}>{icon}</span>
    </div>
  );
}

function InstallIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-text-1)" }}>
      <path d="M12 2v13M8 11l4 4 4-4"/>
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98M21 5a3 3 0 11-6 0 3 3 0 016 0zM9 12a3 3 0 11-6 0 3 3 0 016 0zM21 19a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  );
}

function AddBoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M12 8v8M8 12h8"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-text-1)" }}>
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="4" y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-text-1)" }}>
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/>
    </svg>
  );
}

function RunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M7 21l3-6 3 3 2-4"/>
      <path d="M14 13l2-3-3-2 1-3"/>
      <path d="M8 13l-1 4"/>
    </svg>
  );
}

function WalkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M9 20l1.5-6L9 11l3-3 2 2h3"/>
      <path d="M12 8l-2 3 2 3"/>
      <path d="M15 20l-1.5-6"/>
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" style={{ color: "var(--c-text-1)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
