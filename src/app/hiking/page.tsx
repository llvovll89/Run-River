"use client";

import {useEffect, useRef, useState} from "react";
import dynamic from "next/dynamic";
import {parseGpx, saveHikingCourse, readHikingCourse, clearHikingCourse, type HikingCourse} from "@/lib/hiking";
import {hasNativeRun, NativeRun} from "@/lib/nativeRun";
import {getSupabaseBrowserClient} from "@/lib/supabaseClient";
import {useOfflineMapPack} from "@/hooks/useOfflineMapPack";
import {navigatePublic} from "@/lib/runStorage";
import ScreenHeader from "@/components/ScreenHeader";
import AppNavigation from "@/components/AppNavigation";
import TintedButton from "@/components/TintedButton";
import type {LatLng, RunConfig} from "@/types";
import {extractKmz, parseKml} from "@/lib/kmz";

const OfflineTrailMap = dynamic(() => import("@/components/OfflineTrailMap"), {ssr: false});

export default function HikingPage() {
    const [course, setCourse] = useState<HikingCourse | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [importing, setImporting] = useState(false);
    const [active, setActive] = useState(false);
    const [ready, setReady] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const pack = useOfflineMapPack();
    useEffect(() => {
        try { setCourse(readHikingCourse()); } catch (error) { setError(error instanceof Error ? error.message : "코스를 읽지 못했어요."); }
        if (hasNativeRun()) void NativeRun.snapshot().then(({run}) => setActive(Boolean(run))).catch(() => {});
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
        setBusy(true); setError("");
        try {
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
        } catch (error) { setError(error instanceof Error ? error.message : "하이킹을 시작하지 못했어요."); setBusy(false); }
    }
    return <main className="app-screen min-h-dvh" style={{background: "var(--c-bg)"}}>
        <ScreenHeader title="산길에서도 나의 페이스로" description="하이킹 · 거리와 시간, 올라온 높이를 기록해요." />
        <div className="p-5 space-y-6">
            {error && <p role="alert" className="text-sm" style={{color: "var(--c-danger)"}}>{error}</p>}
            {active && <a href="/running" className="resume-record"><strong>진행 중인 운동이 있어요</strong><span>운동 화면에서 복구하거나 종료해주세요.</span></a>}
            <section className="card rounded-2xl p-5 space-y-3"><h2 className="font-bold text-lg">출발 전에 지도 준비</h2><p className="text-sm leading-6" style={{color: "var(--c-text-2)"}}>{pack ? `${pack.name} 지도를 사용할게요.` : "데이터 연결이 끊겨도 볼 수 있도록 산행 지역의 지도를 먼저 저장해주세요."}</p><a className="underline text-sm" href="/maps">오프라인 지도 저장·관리</a></section>
            <section className="space-y-3" aria-label="산행 코스">
                <h2 className="font-bold text-lg">따라갈 코스 · 선택</h2>
                <p className="text-sm leading-6" style={{color: "var(--c-text-2)"}}>GPX·KMZ·KML 파일을 가져오면 경로와 장소, 구역을 지도에 겹쳐 표시해요. 배경 지도는 따로 저장해주세요.</p>
                {course && <div className="card rounded-2xl p-4 space-y-2"><strong>{course.name}</strong>
                    {course.overlay && <p className="text-sm">경로 {lines.length}개 · 장소 {course.overlay.features.filter(feature => feature.geometry.type === "Point").length}개 · 구역 {course.overlay.features.filter(feature => feature.geometry.type === "Polygon").length}개</p>}
                    {lines.length > 0 && <label className="block text-sm">따라갈 경로<select className="block w-full mt-2 rounded-xl border p-3" value={course.selectedLine ?? ""} disabled={!ready || busy || importing} onChange={event => selectRoute(event.target.value)}><option value="">표시만 하기 · 경로를 따라가지 않음</option>{lines.map((feature, index) => <option key={index} value={index}>{feature.properties.name} ({index + 1})</option>)}</select></label>}
                    <p className="text-sm">{course.points.length >= 2 ? `${course.points.length.toLocaleString()}개 지점 · 선택한 경로에서 멀어지면 안내해요.` : "표시만 불러왔어요. 자유롭게 기록할 수 있어요."}</p>
                    {course.overlay && lines.length > 0 && <p className="text-xs" style={{color: "var(--c-text-2)"}}>주황색은 가져온 표시예요. 따라갈 경로를 선택하면 파란 점선으로 강조해요.</p>}
                    <TintedButton tone="neutral" disabled={!ready || busy || importing} onClick={() => { try { clearHikingCourse(); setCourse(null); } catch { setError("코스를 지우지 못했어요."); } }}>가져온 표시 지우기</TintedButton></div>}
                <TintedButton tone="neutral" disabled={!ready || busy || importing} onClick={() => input.current?.click()}>{importing ? "코스 파일을 읽는 중…" : "GPX·KMZ 코스 가져오기"}</TintedButton>
                <input ref={input} disabled={!ready || busy || importing} type="file" accept=".gpx,.kmz,.kml,application/gpx+xml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml,application/xml,text/xml" className="sr-only" aria-label="코스 파일" onChange={event => { const file = event.target.files?.[0]; if (file) void importCourse(file); event.target.value = ""; }} />
                <p className="text-xs leading-5" style={{color: "var(--c-text-2)"}}>KMZ 최대 10MB · GPX·KML 최대 5MB. 사진·이미지 오버레이·외부 링크·원본 스타일은 가져오지 않아요.</p>
                {(pack || course) && <div style={{height: 330, overflow: "hidden", borderRadius: 20}}><OfflineTrailMap pack={pack} course={course?.points} overlay={course?.overlay} /></div>}
            </section>
            <section className="space-y-3"><TintedButton tone="accent" disabled={!ready || busy || importing || active} onClick={() => void start()}>{busy ? "현재 위치 확인 중…" : "현재 위치에서 하이킹 시작"}</TintedButton><p className="text-sm leading-6" style={{color: "var(--c-text-2)"}}>천천히 올라가도 자동으로 일시정지하지 않아요. 쉬어갈 때 직접 일시정지를 눌러주세요. 하이킹 기록은 우선 이 기기에 저장돼요.</p><p className="text-xs leading-5" style={{color: "var(--c-text-2)"}}>아이폰·Android 앱은 화면 잠금 중에도 위치 기록을 이어가요. Safari 등 웹에서는 화면을 켜두세요. 코스 안내는 자동 길찾기를 대신하지 않아요.</p></section>
        </div>
        <AppNavigation />
    </main>;
}
