"use client";

import {useEffect, useRef, useState} from "react";
import dynamic from "next/dynamic";
import {Capacitor} from "@capacitor/core";
import {listOfflineMaps, selectedOfflineMap, selectOfflineMap, downloadSampleMap, importOfflineMap, deleteOfflineMap, type MapPack} from "@/lib/offlineMaps";
import ScreenHeader from "@/components/ScreenHeader";
import AppNavigation from "@/components/AppNavigation";
import TintedButton from "@/components/TintedButton";
import AreaMapSaver from "@/components/AreaMapSaver";
import type {LatLng} from "@/types";

const MapView = dynamic(() => import("@/components/MapView"), {ssr: false});

export default function MapsPage() {
    const [packs, setPacks] = useState<MapPack[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [removeId, setRemoveId] = useState<string | null>(null);
    // Preview opens on the user's position when location access was already granted.
    const [position, setPosition] = useState<LatLng | null | undefined>(undefined);
    const fileInput = useRef<HTMLInputElement>(null);
    async function refresh() { setPacks(await listOfflineMaps()); setSelected(selectedOfflineMap()); }
    useEffect(() => {
        setReady(true); void refresh().catch(error => setError(error.message));
        let done = false;
        const finish = (value: LatLng | null) => { if (!done) { done = true; setPosition(value); } };
        const timer = setTimeout(() => finish(null), 3000);
        const locate = () => navigator.geolocation?.getCurrentPosition(fix => finish({lat: fix.coords.latitude, lng: fix.coords.longitude}), () => finish(null), {timeout: 2500, maximumAge: 5 * 60_000});
        // Never prompt on page load (WKWebView asks again per session): only use an already-granted permission.
        if (navigator.permissions?.query) void navigator.permissions.query({name: "geolocation"}).then(state => state.state === "granted" ? locate() : finish(null), () => finish(null));
        else finish(null);
        return () => clearTimeout(timer);
    }, []);
    async function action(task: () => Promise<unknown>, message: string) {
        setBusy(true); setError(""); setStatus("");
        try { await task(); await refresh(); setStatus(message); }
        catch (error) { setError(error instanceof Error || error instanceof DOMException ? error.message : "지도 작업을 완료하지 못했어요."); }
        finally { setBusy(false); }
    }
    const pack = packs.find(pack => pack.id === selected);
    const statusRef = useRef<HTMLDivElement>(null);
    // 아래쪽 버튼에서 시작한 작업이어도 진행·결과 문구가 화면에 들어오게 한다.
    useEffect(() => { if (busy || status || error) statusRef.current?.scrollIntoView({block: "nearest", behavior: "smooth"}); }, [busy, status, error]);
    return <main className="app-screen min-h-dvh" style={{background: "var(--c-bg)"}}>
        <ScreenHeader title="오프라인 지도" description="데이터가 안 터지는 산에서도 볼 수 있게, 갈 곳의 지도를 미리 저장해두세요." />
        <div className="page-body">
            <div ref={statusRef} style={{scrollMarginTop: "calc(var(--sat) + 12px)"}}>
                {error && <p role="alert" className="page-status" style={{color: "var(--c-danger-text)"}}>{error}</p>}
                <p role="status" className="page-status">{busy ? "지도 파일을 준비하고 있어요. 잠시 기다려주세요…" : status}</p>
            </div>
            <AreaMapSaver disabled={!ready || busy} onSaved={saved => { void refresh(); setStatus(`${saved.name} 지도를 기기에 저장했어요.`); }} />
            <section aria-label="저장한 지도" className="page-section">
                <h2>저장한 지도{packs.length > 0 && <span className="num" style={{color: "var(--c-text-2)", fontWeight: 560}}> {packs.length}</span>}</h2>
                {packs.length === 0 && <p>아직 저장한 지도가 없어요. 위에서 지역을 고르거나 북한산 지도로 먼저 확인해보세요.</p>}
                <div className="mt-2">
                    {packs.map(map => <div key={map.id} className="saved-map">
                        <strong>{map.name}</strong>
                        <p><span className="num">{(map.size / 1024 / 1024).toFixed(1)} MB</span>{selected === map.id ? ", 운동할 때 이 지도를 써요" : ""}</p>
                        <div className="section-actions" style={{marginTop: 10}}>
                            <TintedButton tone={selected === map.id ? "neutral" : "accent"} disabled={!ready || busy || selected === map.id} onClick={() => { selectOfflineMap(map.id); setSelected(map.id); }}>{selected === map.id ? "사용 중" : "이 지도 사용"}</TintedButton>
                            <TintedButton tone="neutral" disabled={!ready || busy} onClick={() => setRemoveId(map.id)}>삭제</TintedButton>
                        </div>
                        {removeId === map.id && <div role="group" aria-label="지도 삭제 확인" className="mt-3">
                            <p style={{fontSize: 15}}>삭제하면 이 지역은 다시 저장해야 볼 수 있어요.</p>
                            <div className="section-actions" style={{marginTop: 10}}><TintedButton tone="neutral" onClick={() => setRemoveId(null)}>취소</TintedButton><TintedButton tone="danger-solid" disabled={!ready || busy} onClick={() => void action(async () => { await deleteOfflineMap(map.id); setRemoveId(null); }, "지도를 삭제했어요.")}>삭제 확인</TintedButton></div>
                        </div>}
                    </div>)}
                </div>
            </section>
            {pack && <section className="page-section" aria-label="오프라인 지도 미리보기">
                <h2>{pack.name} 미리보기</h2>
                <div className="mt-3" style={{height: "min(400px, 50dvh)", borderRadius: 18, overflow: "hidden", border: "1px solid var(--c-border)"}}>{position !== undefined && <MapView key={pack.id} className="h-full" pack={pack} center={position ?? undefined} currentPosition={position} showControls controlsTop="12px" />}</div>
                <p className="section-fine">갈색 점선은 산길과 보행로예요. 저장한 범위 밖은 비어 보여요.</p>
            </section>}
            <section className="page-section" aria-label="지도 저장">
                <h2>북한산 지도로 먼저 확인하기</h2>
                <p>등산로와 주변 도로가 담긴 3.5MB 지도예요. 저장한 뒤 비행기 모드에서 열리는지 확인해보세요.</p>
                <div className="section-actions"><TintedButton tone="neutral" disabled={!ready || busy} onClick={() => void action(downloadSampleMap, "북한산 지도를 기기에 저장했어요.")}>북한산 지도 저장</TintedButton></div>
                <p className="section-fine">2026년 11월 13일 지도 데이터. 등고선과 오프라인 길찾기는 없어요.</p>
            </section>
            <section className="page-section">
                <h2>지도 파일 가져오기</h2>
                <p>Protomaps나 OpenMapTiles 형식의 PMTiles 파일을 쓸 수 있어요. 파일 하나에 200MB까지예요.</p>
                <div className="section-actions"><TintedButton tone="neutral" disabled={!ready || busy} onClick={() => { if (["android", "ios"].includes(Capacitor.getPlatform())) void action(() => importOfflineMap(), "지도를 가져왔어요."); else fileInput.current?.click(); }}>지도 파일 가져오기</TintedButton></div>
                <input ref={fileInput} disabled={!ready || busy} type="file" accept=".pmtiles" className="sr-only" aria-label="PMTiles 지도 파일" onChange={event => { const file = event.target.files?.[0]; if (file) void action(() => importOfflineMap(file), "지도를 가져왔어요."); event.target.value = ""; }} />
            </section>
            <nav className="page-links" aria-label="관련 화면">
                <a href="/hiking">GPX·KMZ 코스를 지도에 겹쳐보기</a>
                <a href="/">운동 시작 화면으로</a>
            </nav>
            <p className="page-footnote">웹에서는 브라우저 데이터를 정리하면 저장한 지도도 지워져요. 운동 기록은 지도와 따로 보관돼요. 산에서는 현장의 통제와 표지판을 먼저 따라주세요.</p>
        </div>
        <AppNavigation />
    </main>;
}
