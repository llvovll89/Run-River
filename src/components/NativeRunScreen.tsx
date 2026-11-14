"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import dynamic from "next/dynamic";
import {NativeRun, nativeRunResult, type NativeRunSnapshot} from "@/lib/nativeRun";
import {readActiveRun, saveLocalResult, navigatePublic} from "@/lib/runStorage";
import {formatDuration, formatPace} from "@/lib/utils";
import type {RunConfig} from "@/types";
import ScreenHeader from "@/components/ScreenHeader";
import TintedButton from "@/components/TintedButton";
import {useOfflineMapPack} from "@/hooks/useOfflineMapPack";
import {distanceToCourseMeters} from "@/lib/hiking";

const KakaoMap = dynamic(() => import("@/components/KakaoMap"), {ssr: false});
const OfflineTrailMap = dynamic(() => import("@/components/OfflineTrailMap"), {ssr: false});

export default function NativeRunScreen() {
    const mapPack = useOfflineMapPack();
    const [run, setRun] = useState<NativeRunSnapshot | null>(null);
    const [error, setError] = useState("");
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmFinish, setConfirmFinish] = useState(false);
    const initialized = useRef(false);
    const mounted = useRef(false);
    const polling = useRef(false);
    const [now, setNow] = useState(Date.now());
    const offCourseSince = useRef<number | null>(null);
    const [offCourse, setOffCourse] = useState(false);

    useEffect(() => {
        const course = run?.config.routePath;
        if (!run?.position || !course || course.length < 2 || run.status !== "recording" || !run.lastFixAt || now - run.lastFixAt > 30000) {
            offCourseSince.current = null; setOffCourse(false); return;
        }
        const distance = distanceToCourseMeters(run.position, course);
        if (distance <= Math.max(80, (run.accuracy ?? 40) * 2)) { offCourseSince.current = null; setOffCourse(false); return; }
        offCourseSince.current ??= now;
        setOffCourse(now - offCourseSince.current >= 15000);
    }, [run, now]);

    const refresh = useCallback(async () => {
        if (polling.current) return;
        polling.current = true;
        try {
            const {run: current} = await NativeRun.snapshot();
            if (mounted.current) { setRun(current); setNow(Date.now()); }
        } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "기기 기록을 읽지 못했어요."); }
        finally { polling.current = false; }
    }, []);

    useEffect(() => {
        mounted.current = true;
        if (!initialized.current) {
            initialized.current = true;
            void (async () => {
                try {
                    const {run: current} = await NativeRun.snapshot();
                    if (current) {
                        // Keep the existing native session even if a new web config is present.
                        setRun(current);
                    } else {
                        const raw = sessionStorage.getItem("runConfig");
                        if (!raw) {
                            if (readActiveRun()) throw new Error("기존 웹 운동이 있어요. 웹에서 복구·종료한 후 새 운동을 시작해주세요.");
                            throw new Error("시작할 운동이 없어요. 홈에서 목표를 선택해주세요.");
                        }
                        const config = JSON.parse(raw) as RunConfig;
                        if (config.intervalPreset) throw new Error("Android 위치 기록은 거리·시간·목적지 운동부터 지원해요. 홈에서 목표를 다시 선택해주세요.");
                        await NativeRun.start({config: {...config, runId: config.runId ?? crypto.randomUUID()}});
                        sessionStorage.removeItem("runConfig");
                        await refresh();
                    }
                } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "운동을 시작하지 못했어요."); }
                finally { if (mounted.current) setReady(true); }
            })();
        }
        const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 2000);
        const visible = () => { if (document.visibilityState === "visible") void refresh(); };
        document.addEventListener("visibilitychange", visible);
        return () => { mounted.current = false; clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
    }, [refresh]);

    async function act(action: "pause" | "resume" | "finish") {
        setBusy(true); setError("");
        try { await NativeRun[action](); await refresh(); setConfirmFinish(false); }
        catch (error) { setError(error instanceof Error ? error.message : "다시 시도해주세요."); }
        finally { setBusy(false); }
    }

    async function exportResult() {
        if (!run || run.status !== "finished") return;
        setBusy(true); setError("");
        try {
            const result = nativeRunResult(run);
            // Keep SQLite until the full result is safely copied. Retries use the same ID.
            saveLocalResult(result);
            await NativeRun.acknowledge({runId: run.config.runId});
            sessionStorage.removeItem("runConfig");
            navigatePublic(`/result?id=${result.id}`);
        } catch (error) { setError(error instanceof Error ? error.message : "기기에 결과를 옮기지 못했어요. 공간 확보 후 다시 눌러주세요."); }
        finally { setBusy(false); }
    }

    const seconds = Math.floor((run?.elapsedMs ?? 0) / 1000);
    const points = run?.trackPoints ?? [];
    const stale = !run?.lastFixAt || now - run.lastFixAt > 30000;
    return <main className="app-screen min-h-dvh" style={{background: "var(--c-bg)", paddingBottom: 36}}>
        <ScreenHeader title={run?.status === "finished" ? "운동을 마쳤어요" : run?.status === "paused" ? "잠시 쉬어가는 중" : "나의 길을 기록해요"}
            description={run?.config.activityType === "hiking" ? "하이킹 · 위치와 이동 경로를 휴대폰에 저장해요." : "위치와 이동 경로를 휴대폰에 저장해요."} />
        <section className="px-5 space-y-5">
            {(error || run?.error) && <p role="alert" className="rounded-2xl p-4" style={{background: "var(--c-elevated)", color: "var(--c-danger)"}}>{error || run?.error}</p>}
            {!ready && <p role="status">기기에 저장된 운동을 확인하고 있어요…</p>}
            {run && <>
                {run.config.courseName && <p className="text-sm font-semibold">따라가는 코스 · {run.config.courseName}</p>}
                {offCourse && <p role="alert" className="rounded-xl p-3 text-sm" style={{background: "var(--c-elevated)"}}>준비한 코스에서 벗어나 있어요. GPS 위치와 실제 길을 함께 확인해주세요.</p>}
                <p className="text-sm" role="status">{run.status === "recording" ? stale ? "GPS 수신을 기다리고 있어요 · 하늘이 보이는 곳에서 잠시 기다려주세요" : `GPS 수신 중 · 정확도 약 ${Math.round(run.accuracy ?? 0)}m` : run.status === "paused" ? "기록 일시정지 · 재개를 누르면 이어서 기록해요" : "기기에 기록을 보관했어요 · 결과를 저장해주세요"}</p>
                <div style={{position: "relative", height: "36vh", minHeight: 230, overflow: "hidden", borderRadius: 24}}>
                    {mapPack ? <OfflineTrailMap pack={mapPack} currentPosition={run.position} points={points} course={run.config.routePath} follow /> : <KakaoMap className="h-full" center={run.position ?? run.config.startPoint} currentPosition={run.position} startPoint={run.config.startPoint} pathPoints={points} routePath={run.config.routePath} activityType={run.config.activityType} followUser />}
                </div>
                <dl className="grid grid-cols-2 gap-5 py-3" aria-label="운동 측정값">
                    {[["이동 거리", `${run.distanceKm.toFixed(2)} km`], ["기록 시간", formatDuration(seconds)], ["현재 고도", run.currentAltitude == null ? "수신 대기" : `${Math.round(run.currentAltitude)} m`], ["누적 상승", `${Math.round(run.elevationGain)} m`], ["평균 페이스", formatPace(nativeRunResult(run).pace)], ["누적 하강", `${Math.round(run.elevationLoss)} m`]].map(([label, value]) => <div key={label}><dt className="text-xs mb-1" style={{color: "var(--c-text-2)"}}>{label}</dt><dd className="num text-2xl font-bold">{value}</dd></div>)}
                </dl>
                {run.status !== "finished" ? <div className="flex gap-3">
                    <TintedButton disabled={busy} tone="neutral" onClick={() => void act(run.status === "recording" ? "pause" : "resume")}>{run.status === "recording" ? "일시정지" : "기록 재개"}</TintedButton>
                    <TintedButton disabled={busy} tone="danger-solid" onClick={() => setConfirmFinish(true)}>운동 종료</TintedButton>
                </div> : <TintedButton tone="accent" disabled={busy} onClick={() => void exportResult()}>결과 저장하기</TintedButton>}
                {confirmFinish && <div role="dialog" aria-modal="true" aria-label="운동 종료 확인" className="rounded-2xl p-5 space-y-4" style={{background: "var(--c-surface)"}}><p>운동을 마치고 현재까지의 기록을 보관할까요?</p><div className="flex gap-3"><TintedButton disabled={busy} tone="neutral" onClick={() => setConfirmFinish(false)}>계속 운동</TintedButton><TintedButton disabled={busy} tone="danger-solid" onClick={() => void act("finish")}>종료 확인</TintedButton></div></div>}
                <p className="text-xs leading-5" style={{color: "var(--c-text-2)"}}>화면을 꺼도 Android 위치 서비스가 기록해요. 앱 강제 종료·권한 해제·GPS 수신 불량 구간은 기록이 끊길 수 있어요. {mapPack ? `저장한 지도 · ${mapPack.name}` : "오프라인 지도는 출발 전에 지도 준비 화면에서 저장해주세요."}</p>
            </>}
            <a href="/" className="inline-block underline text-sm">홈으로 돌아가기</a>
        </section>
    </main>;
}
