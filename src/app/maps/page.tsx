"use client";

import {useEffect, useRef, useState} from "react";
import dynamic from "next/dynamic";
import {Capacitor} from "@capacitor/core";
import {listOfflineMaps, selectedOfflineMap, selectOfflineMap, downloadSampleMap, importOfflineMap, deleteOfflineMap, type MapPack} from "@/lib/offlineMaps";
import ScreenHeader from "@/components/ScreenHeader";
import AppNavigation from "@/components/AppNavigation";
import TintedButton from "@/components/TintedButton";

const OfflineTrailMap = dynamic(() => import("@/components/OfflineTrailMap"), {ssr: false});

export default function MapsPage() {
    const [packs, setPacks] = useState<MapPack[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [removeId, setRemoveId] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    async function refresh() { setPacks(await listOfflineMaps()); setSelected(selectedOfflineMap()); }
    useEffect(() => { void refresh().catch(error => setError(error.message)); }, []);
    async function action(task: () => Promise<unknown>, message: string) {
        setBusy(true); setError(""); setStatus("");
        try { await task(); await refresh(); setStatus(message); }
        catch (error) { setError(error instanceof Error ? error.message : "지도 작업을 완료하지 못했어요."); }
        finally { setBusy(false); }
    }
    const pack = packs.find(pack => pack.id === selected);
    return <main className="app-screen min-h-dvh" style={{background: "var(--c-bg)"}}>
        <ScreenHeader title="산에 가기 전, 지도 준비" description="연결이 끊겨도 저장한 지도를 펼쳐볼 수 있어요." />
        <div className="p-5 space-y-6">
            {error && <p role="alert" className="text-sm" style={{color: "var(--c-danger)"}}>{error}</p>}
            <p role="status" className="text-sm">{busy ? "지도 파일을 준비하고 있어요. 잠시 기다려주세요…" : status}</p>
            <section className="card rounded-2xl p-5 space-y-3" aria-label="지도 저장">
                <h2 className="text-lg font-bold">북한산 주변</h2>
                <p className="text-sm leading-6" style={{color: "var(--c-text-2)"}}>등산로와 주변 도로를 담은 약 3.5MB 지도예요. 출발 전에 저장하고 데이터 연결을 끈 상태에서 확인해주세요.</p>
                <TintedButton tone="accent" disabled={busy} onClick={() => void action(downloadSampleMap, "북한산 지도를 기기에 저장했어요.")}>북한산 지도 저장</TintedButton>
                <p className="text-xs" style={{color: "var(--c-text-2)"}}>지도 데이터 기준 2026.11.13 · 등고선·오프라인 길찾기는 포함하지 않아요.</p>
            </section>
            <section aria-label="저장한 지도" className="space-y-3">
                <h2 className="text-lg font-bold">기기에 저장한 지도 {packs.length > 0 && `· ${packs.length}`}</h2>
                {packs.length === 0 && <p className="text-sm" style={{color: "var(--c-text-2)"}}>아직 저장한 지도가 없어요.</p>}
                {packs.map(map => <div key={map.id} className="card rounded-2xl p-4 space-y-3">
                    <div><strong>{map.name}</strong><p className="text-xs mt-1" style={{color: "var(--c-text-2)"}}>{(map.size / 1024 / 1024).toFixed(1)} MB · {selected === map.id ? "운동할 때 사용할 지도" : "기기에 보관 중"}</p></div>
                    <div className="flex gap-3"><TintedButton tone="accent" disabled={busy || selected === map.id} onClick={() => { selectOfflineMap(map.id); setSelected(map.id); }}>이 지도 사용</TintedButton><TintedButton tone="neutral" disabled={busy} onClick={() => setRemoveId(map.id)}>삭제</TintedButton></div>
                    {removeId === map.id && <div role="group" aria-label="지도 삭제 확인" className="space-y-2"><p className="text-sm">삭제하면 이 지역은 다시 저장해야 볼 수 있어요.</p><div className="flex gap-3"><TintedButton tone="neutral" onClick={() => setRemoveId(null)}>취소</TintedButton><TintedButton tone="danger" disabled={busy} onClick={() => void action(async () => { await deleteOfflineMap(map.id); setRemoveId(null); }, "지도를 삭제했어요.")}>삭제 확인</TintedButton></div></div>}
                </div>)}
            </section>
            {pack && <section className="space-y-2" aria-label="오프라인 지도 미리보기"><h2 className="text-lg font-bold">{pack.name} 미리보기</h2><div style={{height: 400, borderRadius: 20, overflow: "hidden"}}><OfflineTrailMap key={pack.id} pack={pack} /></div><p className="text-xs" style={{color: "var(--c-text-2)"}}>갈색 점선은 산길·보행로예요. 지도 범위 밖은 추가로 저장해야 해요.</p></section>}
            <section className="space-y-3"><h2 className="text-lg font-bold">다른 지역 지도 가져오기</h2><p className="text-sm leading-6" style={{color: "var(--c-text-2)"}}>Protomaps 형식의 PMTiles 파일을 가져올 수 있어요. 지도별 최대 200MB를 지원해요.</p><TintedButton tone="neutral" disabled={busy} onClick={() => { if (Capacitor.getPlatform() === "android") void action(() => importOfflineMap(), "지도를 가져왔어요."); else fileInput.current?.click(); }}>지도 파일 가져오기</TintedButton><input ref={fileInput} type="file" accept=".pmtiles" className="sr-only" aria-label="PMTiles 지도 파일" onChange={event => { const file = event.target.files?.[0]; if (file) void action(() => importOfflineMap(file), "지도를 가져왔어요."); event.target.value = ""; }} /></section>
            <p className="text-xs leading-5" style={{color: "var(--c-text-2)"}}>Android 앱은 앱 전용 공간에 지도를 보관해요. 웹에서는 브라우저 데이터 정리로 지도가 지워질 수 있어요. 이동 기록은 지도 삭제와 별도로 보관돼요. 현장의 통제·표지판을 먼저 확인해주세요.</p>
            <a href="/" className="inline-block underline text-sm">운동 시작 화면으로</a>
        </div>
        <AppNavigation />
    </main>;
}
