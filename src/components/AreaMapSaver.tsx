"use client";

import dynamic from "next/dynamic";
import {useEffect, useRef, useState} from "react";
import TintedButton from "@/components/TintedButton";
import {AREA_MAX_TILES, countAreaTiles, estimateAreaBytes, type Bounds} from "@/lib/areaMaps";
import {downloadAreaMap, networkKind, type AreaProgress, type MapPack, type NetworkKind} from "@/lib/offlineMaps";
import {areaName} from "@/lib/kakaoServices";
import type {LatLng} from "@/types";

const MapView = dynamic(() => import("@/components/MapView"), {ssr: false});
const mb = (bytes: number) => bytes < 1024 * 1024 ? "1MB 미만" : `${Math.round(bytes / 1024 / 1024)}MB`;

/** Pick an area on the online map (opening at the user's position) and save it for offline use. */
export default function AreaMapSaver({disabled, onSaved}: {disabled: boolean; onSaved: (pack: MapPack) => void}) {
    const [open, setOpen] = useState(false);
    // undefined: still locating; null: no position (map opens on Seoul).
    const [center, setCenter] = useState<LatLng | null | undefined>(undefined);
    const [view, setView] = useState<Bounds | null>(null);
    const [network, setNetwork] = useState<NetworkKind>("unknown");
    const [online, setOnline] = useState(true);
    const [progress, setProgress] = useState<AreaProgress | null>(null);
    const [error, setError] = useState("");
    const abort = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!open) return;
        const update = () => { setOnline(navigator.onLine); void networkKind().then(setNetwork); };
        update();
        const connection = (navigator as Navigator & {connection?: EventTarget}).connection;
        window.addEventListener("online", update); window.addEventListener("offline", update);
        connection?.addEventListener?.("change", update);
        return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); connection?.removeEventListener?.("change", update); };
    }, [open]);
    useEffect(() => () => abort.current?.abort(), []);

    function openPicker() {
        setOpen(true); setError(""); setView(null);
        if (!navigator.geolocation) { setCenter(null); return; }
        setCenter(undefined);
        let settled = false;
        const finish = (value: LatLng | null) => { if (!settled) { settled = true; setCenter(value); } };
        // A permission prompt left unanswered never calls back: open the map anyway.
        setTimeout(() => finish(null), 10_000);
        navigator.geolocation.getCurrentPosition(fix => finish({lat: fix.coords.latitude, lng: fix.coords.longitude}), () => finish(null), {enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000});
    }

    async function save() {
        if (!view) return;
        const controller = new AbortController();
        abort.current = controller; setError("");
        setProgress({done: 0, total: countAreaTiles(view), bytes: 0});
        try {
            const place = await areaName((view[1] + view[3]) / 2, (view[0] + view[2]) / 2).catch(() => null);
            const today = new Date();
            const name = place ? `${place} 주변` : `저장한 지역 ${today.getMonth() + 1}.${today.getDate()}`;
            const pack = await downloadAreaMap(view, name, setProgress, controller.signal);
            setOpen(false); onSaved(pack);
        } catch (failure) {
            setError(failure instanceof DOMException && failure.name === "AbortError" ? "지도 저장을 취소했어요." : failure instanceof Error ? failure.message : "지도를 저장하지 못했어요.");
        } finally { setProgress(null); abort.current = null; }
    }

    const tiles = view ? countAreaTiles(view) : 0;
    const tooBig = tiles > AREA_MAX_TILES;
    const size = view ? mb(estimateAreaBytes(view)) : "";

    if (!open) return <section className="page-section" aria-label="지역 지도 저장">
        <h2>갈 곳의 지도 저장</h2>
        <p>지도를 옮겨 화면에 담은 지역을 기기에 저장해요. 등산로, 도로, 지명이 함께 저장돼요.</p>
        {error && <p role="alert" style={{color: "var(--c-danger-text)"}}>{error}</p>}
        <div className="section-actions"><TintedButton tone="accent" wide disabled={disabled} onClick={openPicker}>지도에서 지역 고르기</TintedButton></div>
    </section>;

    return <section className="page-section" aria-label="지역 지도 저장">
        <div className="flex items-center justify-between gap-3">
            <h2>저장할 지역 고르기</h2>
            {!progress && <button type="button" className="btn" data-tone="neutral" style={{minHeight: 44}} onClick={() => setOpen(false)}>닫기</button>}
        </div>
        <p>화면에 보이는 범위를 저장해요. 두 손가락으로 확대·축소해 범위를 맞춰주세요.</p>
        <div className="mt-3" style={{height: "min(340px, 46dvh)", borderRadius: 18, overflow: "hidden", position: "relative", border: "1px solid var(--c-border)"}}>
            {center === undefined
                ? <p role="status" className="map-notice">내 위치를 찾는 중…</p>
                : <MapView className="h-full" testId="area-picker-map" center={center ?? undefined} currentPosition={center} initialZoom={13} showControls controlsTop="12px" onViewChange={setView} />}
        </div>
        {center === null && <p className="section-fine">내 위치를 찾지 못해 서울을 보여줘요.</p>}
        {!online && <p role="alert" style={{color: "var(--c-danger-text)", fontWeight: 650}}>인터넷에 연결되어야 지역을 저장할 수 있어요.</p>}
        {view && online && <div className="mt-3 space-y-1">
            <p style={{fontSize: 16, fontWeight: 680}}>{tooBig ? "범위가 너무 넓어요. 지도를 확대해 범위를 줄여주세요." : <>이 범위를 저장하면 최대 <span className="num">{size}</span></>}</p>
            {!tooBig && network === "wifi" && <p className="section-fine" style={{marginTop: 2}}>Wi‑Fi에 연결되어 있어요.</p>}
            {!tooBig && network === "cellular" && <p role="alert" style={{fontSize: 15, fontWeight: 650, color: "var(--c-danger-text)"}}>Wi‑Fi가 아니에요. 모바일 데이터를 최대 {size} 써요.</p>}
            {!tooBig && network === "unknown" && <p className="section-fine" style={{marginTop: 2}}>Wi‑Fi가 아니면 모바일 데이터를 최대 {size} 써요. 산은 보통 이보다 훨씬 적어요.</p>}
        </div>}
        {error && <p role="alert" style={{color: "var(--c-danger-text)"}}>{error}</p>}
        {progress
            ? <div className="mt-4 space-y-2" role="status" aria-label="지도 저장 진행">
                <div style={{height: 6, borderRadius: 3, background: "var(--c-river-track)", overflow: "hidden"}}><div style={{width: `${progress.total ? progress.done / progress.total * 100 : 0}%`, height: "100%", background: "var(--c-river)"}} /></div>
                <p style={{fontSize: 15}}>지도를 받는 중 <span className="num">{progress.done}/{progress.total}</span>, <span className="num">{(progress.bytes / 1024 / 1024).toFixed(1)}MB</span></p>
                <TintedButton tone="neutral" wide onClick={() => abort.current?.abort()}>저장 취소</TintedButton>
            </div>
            : <div className="section-actions"><TintedButton tone="accent" wide disabled={disabled || !view || tooBig || !online} onClick={() => void save()}>{network === "cellular" ? "모바일 데이터로 이 지역 저장" : "이 지역 저장"}</TintedButton></div>}
    </section>;
}
