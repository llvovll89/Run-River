"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { KakaoMapHandle } from "@/components/KakaoMap";
import { useTheme } from "@/hooks/useTheme";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import Image from "next/image";
import type { LatLng, ActivityType } from "@/types";
import { calcDistance } from "@/hooks/useGeolocation";
import PCLanding from "@/components/PCLanding";

const KakaoMap = dynamic(() => import("@/components/KakaoMap"), { ssr: false });

type PointMode = "start" | "end" | null;
type PageMode  = "map" | "goal" | "time";
const GOAL_PRESETS = [3, 5, 10, 21];
const TIME_PRESETS = [15, 20, 30, 45, 60];

export default function Home() {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [startPoint, setStartPoint] = useState<LatLng | null>(null);
  const [endPoint, setEndPoint]     = useState<LatLng | null>(null);
  const [mode, setMode]             = useState<PointMode>("start");
  const [activityType, setActivityType] = useState<ActivityType>("running");
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(true);
  const [pageMode, setPageMode]     = useState<PageMode>("map");
  const [goal, setGoal] = useState({ distance: 5, distanceInput: "", time: 30, timeInput: "" });
  const [search, setSearch] = useState<{
    open: boolean; query: string; results: kakao.maps.services.PlaceResult[];
    pointMode: "start" | "end"; loading: boolean; preview: kakao.maps.services.PlaceResult | null;
  }>({ open: false, query: "", results: [], pointMode: "start", loading: false, preview: null });
  const [route, setRoute] = useState<{
    info: { path: LatLng[]; distanceM: number; durationS: number } | null; loading: boolean;
  }>({ info: null, loading: false });
  const [addresses, setAddresses] = useState({ start: "", end: "" });
  const startAddrOverride = useRef<string | null>(null);
  const endAddrOverride   = useRef<string | null>(null);
  const dragY   = useRef(0);
  const didDrag = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const mapRef   = useRef<KakaoMapHandle>(null);
  const hasCenteredRef = useRef(false);

  // PC 감지: 터치 없는 마우스 환경
  useEffect(() => {
    const isPC = window.matchMedia("(pointer: fine) and (hover: hover)").matches
      && window.innerWidth >= 768;
    setIsDesktop(isPC);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (p) => setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      undefined,
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 초기 접속 시 내 위치로 지도 이동
  useEffect(() => {
    if (userLocation && !hasCenteredRef.current) {
      hasCenteredRef.current = true;
      mapRef.current?.panTo(userLocation);
    }
  }, [userLocation]);

  // 역지오코딩 헬퍼
  function reverseGeocode(latlng: LatLng, setter: (s: string) => void) {
    if (!window.kakao?.maps?.services) return;
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(latlng.lng, latlng.lat, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        setter(result[0].address.address_name);
      }
    });
  }

  useEffect(() => {
    if (!startPoint) { setAddresses(prev => ({ ...prev, start: "" })); return; }
    if (startAddrOverride.current) { startAddrOverride.current = null; return; }
    reverseGeocode(startPoint, (v) => setAddresses(prev => ({ ...prev, start: v })));
  }, [startPoint]);

  useEffect(() => {
    if (!endPoint) { setAddresses(prev => ({ ...prev, end: "" })); return; }
    if (endAddrOverride.current) { endAddrOverride.current = null; return; }
    reverseGeocode(endPoint, (v) => setAddresses(prev => ({ ...prev, end: v })));
  }, [endPoint]);

  // 도보 경로 페치 (OSRM)
  useEffect(() => {
    if (!startPoint || !endPoint || pageMode !== "map") {
      setRoute(prev => ({ ...prev, info: null }));
      return;
    }
    let cancelled = false;
    setRoute(prev => ({ ...prev, loading: true }));

    fetch(
      `https://router.project-osrm.org/route/v1/foot/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full&geometries=geojson`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.code !== "Ok" || !data.routes?.[0]) throw new Error("no route");
        const coords = data.routes[0].geometry.coordinates as [number, number][];
        return {
          path: coords.map(([lng, lat]) => ({ lat, lng })),
          distanceM: data.routes[0].distance as number,
          durationS: data.routes[0].duration as number,
        };
      })
      .then((info) => { if (!cancelled) setRoute(prev => ({ ...prev, info })); })
      .catch(() => { if (!cancelled) setRoute(prev => ({ ...prev, info: null })); })
      .finally(() => { if (!cancelled) setRoute(prev => ({ ...prev, loading: false })); });

    return () => { cancelled = true; };
  }, [startPoint, endPoint, pageMode]);

  function handleMapClick(latlng: LatLng) {
    if (mode === "start") { setStartPoint(latlng); setMode("end"); }
    else if (mode === "end") { setEndPoint(latlng); setMode(null); }
  }

  function handleStartPointChange(latlng: LatLng) { setStartPoint(latlng); }
  function handleEndPointChange(latlng: LatLng) { setEndPoint(latlng); }

  function handleSearch() {
    setSearch(prev => ({ ...prev, loading: true }));
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(search.query, (results, status) => {
      setSearch(prev => ({
        ...prev,
        loading: false,
        results: status === kakao.maps.services.Status.OK ? results : [],
      }));
    }, { size: 10 });
  }

  function handleSelectPlace(place: kakao.maps.services.PlaceResult) {
    const latlng: LatLng = { lat: parseFloat(place.y), lng: parseFloat(place.x) };
    if (search.pointMode === "start") {
      startAddrOverride.current = place.place_name;
      setAddresses(prev => ({ ...prev, start: place.place_name }));
      setStartPoint(latlng);
      setMode("end");
    } else {
      endAddrOverride.current = place.place_name;
      setAddresses(prev => ({ ...prev, end: place.place_name }));
      setEndPoint(latlng);
      setMode(null);
    }
    mapRef.current?.panTo(latlng);
    setSearch(prev => ({ ...prev, open: false, query: "", results: [], preview: null }));
    setPageMode("map");
  }

  function handlePreviewPlace(place: kakao.maps.services.PlaceResult) {
    setSearch(prev => ({ ...prev, preview: place }));
    mapRef.current?.panTo({ lat: parseFloat(place.y), lng: parseFloat(place.x) });
  }

  function handlePreviewEnd() {
    setSearch(prev => ({ ...prev, preview: null }));
  }

  function openSearchFor(pointMode: "start" | "end") {
    setSearch(prev => ({ ...prev, pointMode, open: true }));
  }

  function handleStart() {
    if (pageMode === "goal") {
      const origin = userLocation ?? startPoint;
      if (!origin || !goal.distance) return;
      sessionStorage.setItem("runConfig", JSON.stringify({
        startPoint: origin, endPoint: null, activityType, goalDistance: goal.distance, goalTime: null,
      }));
    } else if (pageMode === "time") {
      const origin = userLocation ?? startPoint;
      if (!origin || !goal.time) return;
      sessionStorage.setItem("runConfig", JSON.stringify({
        startPoint: origin, endPoint: null, activityType, goalDistance: null, goalTime: goal.time,
      }));
    } else {
      if (!startPoint || !endPoint) return;
      sessionStorage.setItem("runConfig", JSON.stringify({
        startPoint, endPoint, activityType, goalDistance: null, goalTime: null,
      }));
    }
    router.push("/running");
  }

  const { theme, toggle } = useTheme();
  const { mode: installMode, canInstall, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const canStart  = pageMode === "goal"
    ? !!(userLocation || startPoint) && goal.distance > 0
    : pageMode === "time"
    ? !!(userLocation || startPoint) && goal.time > 0
    : !!(startPoint && endPoint);
  const isRun     = activityType === "running";
  const accentVar = isRun ? "var(--c-toss-blue)" : "var(--c-walk)";

  const routeDistKm = startPoint && endPoint ? calcDistance(startPoint, endPoint) : null;
  const routeDistLabel = route.info
    ? route.info.distanceM < 1000
      ? `${Math.round(route.info.distanceM)} m`
      : `${(route.info.distanceM / 1000).toFixed(2)} km`
    : routeDistKm !== null
    ? routeDistKm < 1
      ? `${Math.round(routeDistKm * 1000)} m`
      : `${routeDistKm.toFixed(2)} km`
    : null;
  const routeTimeLabel = route.info
    ? route.info.durationS < 60
      ? `${Math.round(route.info.durationS)}초`
      : `${Math.round(route.info.durationS / 60)}분`
    : null;

  const guide = pageMode === "goal"
    ? { text: `목표: ${goal.distance} km · 위치 자동 설정`, color: accentVar }
    : !startPoint
    ? { text: "출발 지점을 탭하세요", color: "var(--c-toss-blue)" }
    : !endPoint
    ? { text: "도착 지점을 탭하세요", color: "#f59e0b" }
    : { text: "준비 완료 · 출발하세요", color: "var(--c-walk)" };

  if (isDesktop === null) return null;
  if (isDesktop) return <PCLanding />;

  return (
    <main className="relative w-full h-dvh overflow-hidden">
      <KakaoMap
        ref={mapRef}
        center={userLocation ?? { lat: 37.5665, lng: 126.978 }}
        onMapClick={pageMode === "map" ? handleMapClick : undefined}
        onStartPointChange={pageMode === "map" ? handleStartPointChange : undefined}
        onEndPointChange={pageMode === "map" ? handleEndPointChange : undefined}
        startPoint={pageMode === "map" ? startPoint : null}
        endPoint={pageMode === "map" ? endPoint : null}
        currentPosition={userLocation}
        routePath={pageMode === "map" ? (route.info?.path ?? []) : []}
        previewLine={pageMode === "map"}
        previewPoint={search.preview ? { lat: parseFloat(search.preview.y), lng: parseFloat(search.preview.x) } : null}
        className={`absolute inset-0 ${search.open ? "h-[55vh] bottom-0" : "h-full"}`}
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
          <button
              onClick={() => openSearchFor(mode === "end" ? "end" : "start")}
              className="glass rounded-2xl p-2.5 active:scale-95 transition-transform"
              aria-label="장소 검색"
            >
              <SearchIcon />
            </button>
          {userLocation && (
            <button
              onClick={() => mapRef.current?.panTo(userLocation)}
              className="glass rounded-2xl p-2.5 active:scale-95 transition-transform"
              aria-label="내 위치로 이동"
            >
              <LocateIcon />
            </button>
          )}
          {canInstall && (
            <button
              onClick={installMode === "ios" ? () => setShowIOSGuide(true) : promptInstall}
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
            background: `${theme === "dark" ? "#F5F7F8" : "rgba(0,0,0,0.07)"}`,
            backdropFilter: "blur(12px)",
            border: `1px solid ${guide.color}50`,
            color: guide.color,
          }}
        >
          {guide.text}
        </span>
      </div>

      {/* 장소 검색 패널 - 바텀시트 */}
      {search.open && (
        <>
          {/* 딤드 백드롭 - 탭하면 닫힘 */}
          <div
            className="absolute inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(1px)" }}
            onClick={() => setSearch(prev => ({ ...prev, open: false, results: [], query: "" }))}
          />

          {/* 미리보기 플로팅 카드 - 지도 위 상단에 고정 */}
          {search.preview && (
            <div
              className="absolute left-4 right-4 z-50 px-4 py-3 rounded-2xl pointer-events-none"
              style={{
                bottom: "85vh",
                background: "var(--c-bg)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
                border: "1px solid var(--c-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16 }}>{search.pointMode === "start" ? "🏃" : "🏁"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--c-text-1)" }}>
                    {search.preview.place_name}
                  </p>
                  <p className="text-xs truncate mt-0.5" style={{ color: "var(--c-text-3)" }}>
                    {search.preview.road_address_name || search.preview.address_name}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 패널 */}
          <div
            className="absolute bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl overflow-hidden"
            style={{
              height: "50vh",
              background: "var(--c-bg)",
            }}
          >
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-8 h-1 rounded-full" style={{ background: "var(--c-border)" }} />
            </div>

            {/* 검색 헤더 */}
            <div
              className="flex items-center gap-3 px-4 pb-3 shrink-0"
              style={{ borderBottom: "1px solid var(--c-border)" }}
            >
              <button
                onClick={() => setSearch(prev => ({ ...prev, open: false, results: [], query: "" }))}
                className="p-2 rounded-xl active:scale-95 transition-transform"
                style={{ background: "var(--c-elevated)", color: "var(--c-text-2)" }}
              >
                <BackIcon />
              </button>
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
                <SearchIcon small />
                <input
                  autoFocus
                  type="text"
                  value={search.query}
                  onChange={(e) => setSearch(prev => ({ ...prev, query: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="장소, 주소 검색..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: "var(--c-text-1)" }}
                />
                {search.query && (
                  <button onClick={() => setSearch(prev => ({ ...prev, query: "", results: [] }))} style={{ color: "var(--c-text-3)" }}>
                    <ClearIcon />
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={!search.query.trim()}
                className="px-3 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                style={{
                  background: search.query.trim() ? accentVar : "var(--c-elevated)",
                  color: search.query.trim() ? "#fff" : "var(--c-text-3)",
                }}
              >
                검색
              </button>
            </div>

            {/* 포인트 선택 탭 */}
            <div className="px-4 py-2.5 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
              {(["start", "end"] as const).map((m) => {
                const hasPoint = m === "start" ? !!startPoint : !!endPoint;
                const tabColor = m === "start" ? "var(--c-toss-blue)" : "#ff9f0a";
                return (
                  <button
                    key={m}
                    onClick={() => setSearch(prev => ({ ...prev, pointMode: m }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
                    style={{
                      background: search.pointMode === m ? tabColor : "var(--c-elevated)",
                      color: search.pointMode === m ? "#fff" : "var(--c-text-2)",
                      border: hasPoint && search.pointMode !== m ? `1.5px solid ${tabColor}60` : "none",
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: search.pointMode === m ? "#fff" : tabColor }} />
                    {m === "start" ? "출발" : "도착"}
                    {hasPoint && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
              {/* 현재 선택된 주소 미리보기 */}
              {(search.pointMode === "start" ? addresses.start : addresses.end) && (
                <span className="ml-1 text-[11px] truncate flex-1 text-right" style={{ color: "var(--c-text-3)" }}>
                  {search.pointMode === "start" ? addresses.start : addresses.end}
                </span>
              )}
            </div>

            {/* 검색 결과 */}
            <div className="flex-1 overflow-y-auto">
              {search.loading && (
                <div className="flex justify-center items-center py-16" style={{ color: "var(--c-text-3)" }}>
                  검색 중...
                </div>
              )}
              {!search.loading && search.results.length === 0 && search.query && (
                <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: "var(--c-text-3)" }}>
                  <p className="text-sm">검색 결과가 없습니다</p>
                  <p className="text-xs">다른 검색어를 입력해보세요</p>
                </div>
              )}
              {!search.loading && search.results.length === 0 && !search.query && (
                <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: "var(--c-text-3)" }}>
                  <p className="text-sm font-semibold">장소 또는 주소를 검색하세요</p>
                  <p className="text-xs">예: 남산타워, 한강공원, 강남역</p>
                </div>
              )}
              {search.results.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handleSelectPlace(place)}
                  onTouchStart={() => handlePreviewPlace(place)}
                  onTouchEnd={handlePreviewEnd}
                  onMouseEnter={() => handlePreviewPlace(place)}
                  onMouseLeave={handlePreviewEnd}
                  className="w-full px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
                  style={{ borderBottom: "1px solid var(--c-border)" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: search.pointMode === "start" ? "rgba(0,122,255,0.15)" : "rgba(255,159,10,0.15)" }}
                    >
                      <span style={{ fontSize: 14 }}>{search.pointMode === "start" ? "🏃" : "🏁"}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--c-text-1)" }}>{place.place_name}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "var(--c-text-3)" }}>
                        {place.road_address_name || place.address_name}
                      </p>
                      {place.category_name && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--c-text-3)", opacity: 0.7 }}>
                          {place.category_name.split(" > ").slice(-1)[0]}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

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
          transform: sheetOpen ? "translateY(0)" : "translateY(calc(100% - 28px))",
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
            else el.style.transform = sheetOpen ? "translateY(0)" : "translateY(calc(100% - 28px))";
          }}
        >
          <div className="w-8 h-1 rounded-full" style={{ background: "var(--c-border)" }} />
        </div>

        <div className="px-4 space-y-3">
          {/* 모드 탭 */}
          <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--c-elevated)" }}>
            {([["map", "지도 설정"], ["goal", "거리 목표"], ["time", "시간 목표"]] as [PageMode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setPageMode(m)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
                style={{
                  background: pageMode === m ? accentVar : "transparent",
                  color: pageMode === m ? "#fff" : "var(--c-text-2)",
                  boxShadow: pageMode === m ? `0 2px 10px ${accentVar}44` : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

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

          {/* 지도 모드: 포인트 카드 */}
          {pageMode === "map" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <PointCard
                  label="출발" point={startPoint} address={addresses.start} active={mode === "start"} color="var(--c-toss-blue)"
                  onClick={() => openSearchFor("start")}
                  onUseLocation={userLocation ? () => {
                    startAddrOverride.current = "내 위치";
                    setAddresses(prev => ({ ...prev, start: "내 위치" }));
                    setStartPoint(userLocation);
                    mapRef.current?.panTo(userLocation);
                    setMode("end");
                  } : undefined}
                />
                <PointCard
                  label="도착" point={endPoint} address={addresses.end} active={mode === "end"} color="#f59e0b"
                  onClick={() => openSearchFor("end")}
                />
              </div>
              {(routeDistLabel || route.loading) && (
                <div
                  className="flex items-center justify-center gap-2 py-2 rounded-2xl"
                  style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}
                >
                  {route.loading ? (
                    <span className="text-xs" style={{ color: "var(--c-text-3)" }}>경로 계산 중...</span>
                  ) : route.info ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "#007aff", flexShrink: 0 }}>
                        <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
                        <path d="M9 20l1.5-6L9 11l3-3 2 2h3M12 8l-2 3 2 3M15 20l-1.5-6" />
                      </svg>
                      <span className="text-xs font-bold" style={{ color: "#007aff" }}>도보</span>
                      <span className="text-sm font-extrabold num" style={{ color: "var(--c-text-1)", letterSpacing: "-0.03em" }}>{routeDistLabel}</span>
                      {routeTimeLabel && <span className="text-xs" style={{ color: "var(--c-text-3)" }}>약 {routeTimeLabel}</span>}
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: accentVar }}>
                        <path d="M3 12h18M12 5l7 7-7 7" />
                      </svg>
                      <span className="text-xs font-bold num" style={{ color: accentVar }}>직선 거리</span>
                      <span className="text-sm font-extrabold num" style={{ color: "var(--c-text-1)", letterSpacing: "-0.03em" }}>{routeDistLabel}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 거리 목표 모드: 프리셋 + 직접 입력 */}
          {pageMode === "goal" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {GOAL_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setGoal(prev => ({ ...prev, distance: p }))}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={{
                      background: goal.distance === p ? accentVar : "var(--c-elevated)",
                      color: goal.distance === p ? "#fff" : "var(--c-text-2)",
                      border: goal.distance === p ? "none" : "1px solid var(--c-border)",
                      boxShadow: goal.distance === p ? `0 2px 10px ${accentVar}44` : "none",
                    }}
                  >
                    {p === 21 ? "하프" : `${p}km`}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={goal.distanceInput}
                  onChange={(e) => setGoal(prev => ({ ...prev, distanceInput: e.target.value }))}
                  placeholder="직접 입력 (km)"
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none"
                  style={{
                    background: "var(--c-elevated)",
                    border: "1px solid var(--c-border)",
                    color: "var(--c-text-1)",
                  }}
                />
                <button
                  onClick={() => {
                    const n = parseFloat(goal.distanceInput);
                    if (!isNaN(n) && n > 0) { setGoal(prev => ({ ...prev, distance: n, distanceInput: "" })); }
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: accentVar }}
                >
                  설정
                </button>
              </div>
              <p className="text-xs text-center" style={{ color: "var(--c-text-3)" }}>
                현재 위치에서 출발 · 목표 거리 도달 시 자동 완료
              </p>
            </div>
          )}

          {/* 시간 목표 모드: 프리셋 + 직접 입력 */}
          {pageMode === "time" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {TIME_PRESETS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setGoal(prev => ({ ...prev, time: t }))}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={{
                      background: goal.time === t ? accentVar : "var(--c-elevated)",
                      color: goal.time === t ? "#fff" : "var(--c-text-2)",
                      border: goal.time === t ? "none" : "1px solid var(--c-border)",
                      boxShadow: goal.time === t ? `0 2px 10px ${accentVar}44` : "none",
                    }}
                  >
                    {t === 60 ? "1시간" : `${t}분`}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={goal.timeInput}
                  onChange={(e) => setGoal(prev => ({ ...prev, timeInput: e.target.value }))}
                  placeholder="직접 입력 (분)"
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none"
                  style={{
                    background: "var(--c-elevated)",
                    border: "1px solid var(--c-border)",
                    color: "var(--c-text-1)",
                  }}
                />
                <button
                  onClick={() => {
                    const n = parseInt(goal.timeInput, 10);
                    if (!isNaN(n) && n > 0) { setGoal(prev => ({ ...prev, time: n, timeInput: "" })); }
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: accentVar }}
                >
                  설정
                </button>
              </div>
              <p className="text-xs text-center" style={{ color: "var(--c-text-3)" }}>
                현재 위치에서 출발 · 설정한 시간 동안 자유롭게 달립니다
              </p>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            {pageMode === "map" && (startPoint || endPoint) && (
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
              className="flex-1 py-3 rounded-2xl font-bold text-base transition-all duration-200 active:scale-[0.98]"
              style={{
                background: canStart ? accentVar : "var(--c-elevated)",
                border: canStart ? "none" : "1px solid var(--c-border)",
                color: canStart ? "#fff" : "var(--c-text-3)",
                boxShadow: canStart ? `0 4px 20px ${accentVar}44` : "none",
                letterSpacing: "-0.01em",
              }}
            >
              {pageMode === "goal"
                ? canStart ? `${goal.distance}km 달리기 시작` : "위치 확인 중..."
                : pageMode === "time"
                ? canStart ? `${goal.time >= 60 ? "1시간" : `${goal.time}분`} 달리기 시작` : "위치 확인 중..."
                : canStart ? "출발하기" : "포인트를 설정하세요"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function PointCard({
  label, point, address, active, color, onUseLocation, onClick,
}: {
  label: string; point: LatLng | null; address?: string; active: boolean; color: string; onUseLocation?: () => void; onClick?: () => void;
}) {
  const isStart = label === "출발";
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl px-3 py-2.5 transition-all cursor-pointer active:scale-[0.97]${active ? "" : " card"}`}
      style={active ? {
        background: `${color}12`,
        border: `1px solid ${color}55`,
      } : point ? {
        border: `1px solid ${color}40`,
      } : undefined}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: isStart ? "var(--c-toss-blue)" : "#f59e0b" }}
        />
        <span className="text-xs font-semibold" style={{ color: "var(--c-text-2)" }}>{label}</span>
        {active && (
          <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: color }} />
        )}
        {point && !active && (
          <svg className="ml-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ color }}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
        {onUseLocation && (
          <button
            onClick={(e) => { e.stopPropagation(); onUseLocation(); }}
            className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-bold active:scale-95 transition-transform"
            style={{ background: `${color}22`, color }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            내 위치
          </button>
        )}
      </div>
      {point ? (
        <>
          <p className="text-xs font-semibold truncate leading-tight" style={{ color: "var(--c-text-1)" }}>
            {address || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}
          </p>
          <p className="text-[10px] num truncate mt-0.5" style={{ color: "var(--c-text-3)" }}>
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </p>
        </>
      ) : (
        <p className="text-xs" style={{ color: "var(--c-text-3)" }}>탭하여 검색</p>
      )}
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

function LocateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-toss-blue)" }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" strokeOpacity={0.25} />
    </svg>
  );
}

function SearchIcon({ small = false }: { small?: boolean }) {
  const s = small ? 16 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-text-1)" }}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity={0.15} />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}
