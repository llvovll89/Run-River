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

const OfflineTrailMap = dynamic(() => import("@/components/OfflineTrailMap"), {ssr: false});

export default function HikingPage() {
    const [course, setCourse] = useState<HikingCourse | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [active, setActive] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const pack = useOfflineMapPack();
    useEffect(() => {
        try { setCourse(readHikingCourse()); } catch (error) { setError(error instanceof Error ? error.message : "코스를 읽지 못했어요."); }
        if (hasNativeRun()) void NativeRun.snapshot().then(({run}) => setActive(Boolean(run))).catch(() => {});
    }, []);
    async function importCourse(file: File) {
        setError("");
        try {
            if (file.size > 5 * 1024 * 1024) throw new Error("GPX는 5MB 이하 파일을 사용해주세요.");
            const parsed = parseGpx(await file.text(), file.name.replace(/\.gpx$/i, ""));
            saveHikingCourse(parsed); setCourse(parsed);
        } catch (error) { setError(error instanceof Error ? error.message : "코스를 가져오지 못했어요."); }
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
            const config: RunConfig = {runId: crypto.randomUUID(), ownerId, startPoint, endPoint: null, activityType: "hiking", goalDistance: null, goalTime: null, routePath: course?.points, courseName: course?.name};
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
                <p className="text-sm leading-6" style={{color: "var(--c-text-2)"}}>GPX 파일을 가져오면 지도에 코스를 표시해요. 코스 없이 자유롭게 기록할 수도 있어요.</p>
                {course && <div className="card rounded-2xl p-4 space-y-2"><strong>{course.name}</strong><p className="text-sm">{course.points.length.toLocaleString()}개 지점 · 코스에서 멀어지면 화면에 안내해요.</p><TintedButton tone="neutral" onClick={() => { try { clearHikingCourse(); setCourse(null); } catch { setError("코스를 지우지 못했어요."); } }}>코스 없이 기록</TintedButton></div>}
                <TintedButton tone="neutral" disabled={busy} onClick={() => input.current?.click()}>GPX 코스 가져오기</TintedButton>
                <input ref={input} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="sr-only" aria-label="GPX 코스 파일" onChange={event => { const file = event.target.files?.[0]; if (file) void importCourse(file); event.target.value = ""; }} />
                {pack && <div style={{height: 330, overflow: "hidden", borderRadius: 20}}><OfflineTrailMap pack={pack} course={course?.points} /></div>}
            </section>
            <section className="space-y-3"><TintedButton tone="accent" disabled={busy || active} onClick={() => void start()}>{busy ? "현재 위치 확인 중…" : "현재 위치에서 하이킹 시작"}</TintedButton><p className="text-sm leading-6" style={{color: "var(--c-text-2)"}}>천천히 올라가도 자동으로 일시정지하지 않아요. 쉬어갈 때 직접 일시정지를 눌러주세요. 하이킹 기록은 우선 이 기기에 저장돼요.</p><p className="text-xs leading-5" style={{color: "var(--c-text-2)"}}>화면 잠금 중 기록은 Android 앱의 위치 서비스를 사용해요. 웹에서는 화면을 켜두세요. 코스 안내는 자동 길찾기를 대신하지 않아요.</p></section>
        </div>
        <AppNavigation />
    </main>;
}
