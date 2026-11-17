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

    if (!open) return <section className="card rounded-2xl p-5 space-y-3" aria-label="지역 지도 저장">
        <h2 className="text-lg font-bold">원하는 지역 저장</h2>
        <p className="text-sm leading-6" style={{color: "var(--c-text-2)"}}>지도를 움직여 화면에 담긴 지역을 기기에 저장해요. 등산로·도로·지명이 들어가요.</p>
        {error && <p role="alert" className="text-sm" style={{color: "var(--c-danger)"}}>{error}</p>}
        <TintedButton tone="accent" disabled={disabled} onClick={openPicker}>지도에서 지역 고르기</TintedButton>
    </section>;

    return <section className="card rounded-2xl p-4 space-y-3" aria-label="지역 지도 저장">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">저장할 지역 고르기</h2>
            {!progress && <button type="button" className="text-sm underline" onClick={() => setOpen(false)}>닫기</button>}
        </div>
        <p className="text-xs leading-5" style={{color: "var(--c-text-2)"}}>화면에 보이는 범위를 저장해요. 손가락으로 옮기고 확대·축소해 범위를 맞춰주세요.</p>
        <div style={{height: 340, borderRadius: 16, overflow: "hidden", position: "relative"}}>
            {center === undefined
                ? <p role="status" className="map-notice">내 위치를 찾는 중…</p>
                : <MapView className="h-full" testId="area-picker-map" center={center ?? undefined} currentPosition={center} initialZoom={13} showControls controlsTop="12px" onViewChange={setView} />}
        </div>
        {center === null && <p className="text-xs" style={{color: "var(--c-text-2)"}}>내 위치를 찾지 못해 서울을 보여줘요.</p>}
        {!online && <p role="alert" className="text-sm" style={{color: "var(--c-danger)"}}>인터넷에 연결되어야 지역을 저장할 수 있어요.</p>}
        {view && online && <div className="space-y-1">
            <p className="text-sm font-semibold">{tooBig ? "범위가 너무 넓어요. 지도를 확대해 범위를 줄여주세요." : `이 범위 지도: 최대 약 ${size}`}</p>
            {!tooBig && network === "wifi" && <p className="text-xs" style={{color: "var(--c-text-2)"}}>Wi‑Fi에 연결되어 있어요.</p>}
            {!tooBig && network === "cellular" && <p role="alert" className="text-sm font-semibold" style={{color: "var(--c-danger)"}}>Wi‑Fi에 연결되어 있지 않아요. 모바일 데이터를 최대 약 {size} 사용해요.</p>}
            {!tooBig && network === "unknown" && <p className="text-xs" style={{color: "var(--c-text-2)"}}>Wi‑Fi가 아니면 모바일 데이터를 최대 약 {size} 사용해요. 산지는 훨씬 적게 들어요.</p>}
        </div>}
        {error && <p role="alert" className="text-sm" style={{color: "var(--c-danger)"}}>{error}</p>}
        {progress
            ? <div className="space-y-2" role="status" aria-label="지도 저장 진행">
                <div style={{height: 6, borderRadius: 3, background: "var(--c-border)", overflow: "hidden"}}><div style={{width: `${progress.total ? progress.done / progress.total * 100 : 0}%`, height: "100%", background: "var(--c-accent-text)"}} /></div>
                <p className="text-sm">지도를 받는 중… {progress.done}/{progress.total} · {(progress.bytes / 1024 / 1024).toFixed(1)}MB</p>
                <TintedButton tone="neutral" onClick={() => abort.current?.abort()}>저장 취소</TintedButton>
            </div>
            : <TintedButton tone="accent" disabled={disabled || !view || tooBig || !online} onClick={() => void save()}>{network === "cellular" ? "모바일 데이터로 이 지역 저장" : "이 지역 저장"}</TintedButton>}
    </section>;
}
