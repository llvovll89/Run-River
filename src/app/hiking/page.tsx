"use client";

import {useEffect, useRef, useState} from "react";
import dynamic from "next/dynamic";
import {parseGpx, saveHikingCourse, readHikingCourse, clearHikingCourse, type HikingCourse} from "@/lib/hiking";
import {hasNativeRun, NativeRun} from "@/lib/nativeRun";
import {getSupabaseBrowserClient} from "@/lib/supabaseClient";
import {useOfflineMapPack} from "@/hooks/useOfflineMapPack";
import {navigatePublic, readActiveRun} from "@/lib/runStorage";
import ScreenHeader from "@/components/ScreenHeader";
import AppNavigation from "@/components/AppNavigation";
import TintedButton from "@/components/TintedButton";
import type {LatLng, RunConfig} from "@/types";
import {extractKmz, parseKml} from "@/lib/kmz";

const MapView = dynamic(() => import("@/components/MapView"), {ssr: false});

export default function HikingPage() {
    const [course, setCourse] = useState<HikingCourse | null>(null);
    const [error, setError] = useState("");
    const [startError, setStartError] = useState("");
    const [busy, setBusy] = useState(false);
    const [importing, setImporting] = useState(false);
    const [active, setActive] = useState(false);
    const [ready, setReady] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const pack = useOfflineMapPack();
    useEffect(() => {
        try { setCourse(readHikingCourse()); } catch (error) { setError(error instanceof Error ? error.message : "코스를 읽지 못했어요."); }
        if (hasNativeRun()) void NativeRun.snapshot().then(({run}) => setActive(Boolean(run))).catch(() => {});
        else {
            // 웹: 복구할 운동이 남아 있으면 새 하이킹이 그 기록을 덮어쓰지 않도록 시작을 막는다
            try { setActive(Boolean(readActiveRun())); } catch { setActive(true); }
        }
        setReady(true);
    }, []);
    async function importCourse(file: File) {
        setError(""); setImporting(true);
        try {
            const name = file.name.replace(/\.(gpx|kmz|kml)$/i, "");
            const kmz = /\.kmz$/i.test(file.name);
            if (file.size > (kmz ? 10 : 5) * 1024 * 1024) throw new Error(kmz ? "KMZ는 10MB 이하 파일을 사용해주세요." : "GPX·KML은 5MB 이하 파일을 사용해주세요.");
            const parsed = kmz ? parseKml(extractKmz(new Uint8Array(await file.arrayBuffer())), name) : /\.kml$/i.test(file.name) ? parseKml(await file.text(), name) : parseGpx(await file.text(), name);
            saveHikingCourse(parsed); setCourse(parsed);
        } catch (error) { setError(error instanceof Error ? error.message : "코스를 가져오지 못했어요."); }
        finally { setImporting(false); }
    }
    const lines = course?.overlay?.features.filter(feature => feature.geometry.type === "LineString") ?? [];
    function selectRoute(value: string) {
        if (!course) return;
        const selectedLine = value === "" ? undefined : Number(value);
        const geometry = selectedLine === undefined ? null : lines[selectedLine]?.geometry;
        const next = {...course, selectedLine, points: geometry?.type === "LineString" ? geometry.coordinates.map(([lng, lat]) => ({lat, lng})) : []};
        try { saveHikingCourse(next); setCourse(next); } catch { setError("경로 선택을 저장하지 못했어요. 기기 공간을 확인해주세요."); }
    }
    async function start() {
        setBusy(true); setError(""); setStartError("");
        try {
            if (!hasNativeRun() && readActiveRun()) { navigatePublic("/running"); return; }
            if (!navigator.geolocation) throw new Error("이 기기는 GPS 기록을 지원하지 않아요.");
            const startPoint = await new Promise<LatLng>((resolve, reject) => navigator.geolocation.getCurrentPosition(fix => {
                if (fix.coords.accuracy > 40) { reject(new Error("GPS 정확도가 낮아요. 하늘이 보이는 곳에서 다시 시도해주세요.")); return; }
                resolve({lat: fix.coords.latitude, lng: fix.coords.longitude});
            }, () => reject(new Error("현재 위치를 확인하지 못했어요. 위치 권한과 GPS 설정을 확인해주세요.")), {enableHighAccuracy: true, maximumAge: 5000, timeout: 20000}));
            let ownerId: string | null = null;
            try {
                const session = await Promise.race([getSupabaseBrowserClient().auth.getSession(), new Promise<null>(resolve => setTimeout(() => resolve(null), 1500))]);
                ownerId = session?.data.session?.user.id ?? null;
            } catch { /* Offline recordings remain on this device. */ }
            const config: RunConfig = {runId: crypto.randomUUID(), ownerId, startPoint, endPoint: null, activityType: "hiking", goalDistance: null, goalTime: null, routePath: course?.points, courseName: course?.name, courseOverlay: course?.overlay};
            sessionStorage.setItem("runConfig", JSON.stringify(config));
            navigatePublic("/running");
        } catch (error) { setStartError(error instanceof Error ? error.message : "하이킹을 시작하지 못했어요."); setBusy(false); }
    }
    return <main className="app-screen min-h-dvh" style={{background: "var(--c-bg)"}}>
        <ScreenHeader title="하이킹" description="거리와 시간, 올라온 높이를 기록해요. 천천히 걸어도 자동으로 멈추지 않아요." />
        <div className="page-body">
            {error && <p role="alert" className="page-status" style={{color: "var(--c-danger-text)"}}>{error}</p>}
            {active && <a href="/running" className="resume-record mt-4"><strong>진행 중인 운동이 있어요</strong><span>운동 화면에서 이어가거나 종료해주세요.</span></a>}
            <section className="page-section">
                <h2>배경 지도</h2>
                <p>{pack ? <><strong style={{color: "var(--c-text-1)"}}>{pack.name}</strong> 지도를 써요.</> : "산에서는 데이터가 끊기기 쉬워요. 산행 지역 지도를 먼저 저장해두세요."}</p>
                <div className="section-actions"><a className="btn" data-tone="neutral" href="/maps">{pack ? "다른 지도 고르기" : "오프라인 지도 저장하기"}</a></div>
            </section>
            <section className="page-section" aria-label="산행 코스">
                <h2>따라갈 코스</h2>
                <p>GPX, KMZ, KML 파일을 가져오면 경로와 장소, 구역을 지도에 겹쳐 보여줘요. 코스 없이 시작해도 돼요.</p>
                {course && <div className="mt-4 space-y-2">
                    <strong style={{fontSize: 16}}>{course.name}</strong>
                    {course.overlay && <p style={{fontSize: 15}}>경로 {lines.length}개, 장소 {course.overlay.features.filter(feature => feature.geometry.type === "Point").length}개, 구역 {course.overlay.features.filter(feature => feature.geometry.type === "Polygon").length}개</p>}
                    {lines.length > 0 && <label className="block" style={{fontSize: 15, fontWeight: 600}}>따라갈 경로<select className="block w-full mt-2 rounded-xl border" style={{minHeight: 48, padding: "0 12px"}} value={course.selectedLine ?? ""} disabled={!ready || busy || importing} onChange={event => selectRoute(event.target.value)}><option value="">따라가지 않고 표시만 하기</option>{lines.map((feature, index) => <option key={index} value={index}>{feature.properties.name} ({index + 1})</option>)}</select></label>}
                    <p className="section-fine">{course.points.length >= 2 ? `${course.points.length.toLocaleString()}개 지점이에요. 경로에서 멀어지면 알려드려요.` : "표시만 불러왔어요. 자유롭게 기록할 수 있어요."}</p>
                    {course.overlay && lines.length > 0 && <p className="section-fine">주황색은 가져온 표시, 파란 점선은 따라갈 경로예요.</p>}
                </div>}
                <div className="section-actions">
                    <TintedButton tone="neutral" disabled={!ready || busy || importing} onClick={() => input.current?.click()}>{importing ? "코스 파일을 읽는 중…" : course ? "다른 코스 가져오기" : "코스 파일 가져오기"}</TintedButton>
                    {course && <TintedButton tone="neutral" disabled={!ready || busy || importing} onClick={() => { try { clearHikingCourse(); setCourse(null); } catch { setError("코스를 지우지 못했어요."); } }}>코스 지우기</TintedButton>}
                </div>
                <input ref={input} disabled={!ready || busy || importing} type="file" accept=".gpx,.kmz,.kml,application/gpx+xml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml,application/xml,text/xml" className="sr-only" aria-label="코스 파일" onChange={event => { const file = event.target.files?.[0]; if (file) void importCourse(file); event.target.value = ""; }} />
                <p className="section-fine">KMZ는 10MB, GPX와 KML은 5MB까지예요. 사진, 이미지 오버레이, 외부 링크, 원본 스타일은 가져오지 않아요.</p>
                {(pack || course) && <div className="mt-4" style={{height: "min(330px, 44dvh)", overflow: "hidden", borderRadius: 18, border: "1px solid var(--c-border)"}}><MapView className="h-full" pack={pack} course={course?.points} overlay={course?.overlay} showControls controlsTop="12px" /></div>}
            </section>
            <section className="page-section">
                {startError && <p role="alert" style={{marginTop: 0, marginBottom: 12, fontSize: 15, fontWeight: 650, color: "var(--c-danger-text)"}}>{startError}</p>}
                <TintedButton tone="accent" wide disabled={!ready || busy || importing || active} onClick={() => void start()}>{busy ? "현재 위치 확인 중…" : "현재 위치에서 하이킹 시작"}</TintedButton>
                <p>쉬어갈 때는 직접 일시정지를 눌러주세요. 기록은 먼저 이 기기에 저장돼요.</p>
                <p className="section-fine">웹에서는 화면을 켜두어야 위치가 계속 기록돼요. 코스 안내가 길찾기를 대신하지는 않아요.</p>
            </section>
        </div>
        <AppNavigation />
    </main>;
}
