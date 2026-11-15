"use client";

import {useState} from "react";
import type {LatLng, TrackPoint} from "@/types";
import {buildGpx} from "@/lib/hiking";
import {hasNativeRun, NativeRun} from "@/lib/nativeRun";
import TintedButton from "@/components/TintedButton";

export default function ExportGpxButton({name, points}: {name: string; points: (LatLng & Partial<TrackPoint>)[]}) {
    const [error, setError] = useState("");
    const [savedTo, setSavedTo] = useState("");
    const [busy, setBusy] = useState(false);
    if (!points.length) return null;
    return <div className="mt-3"><TintedButton tone="neutral" disabled={busy} onClick={async () => {
        setBusy(true); setError(""); setSavedTo("");
        try {
            const gpx = buildGpx(name, points);
            const filename = `run-river-${new Date().toISOString().slice(0, 10)}.gpx`;
            if (hasNativeRun()) {
                const result = await NativeRun.saveGpx({gpx, filename});
                if (result && result.savedTo) setSavedTo(result.savedTo);
            }
            else {
                const url = URL.createObjectURL(new Blob([gpx], {type: "application/gpx+xml;charset=utf-8"}));
                const link = document.createElement("a"); link.href = url; link.download = filename;
                link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } catch (error) { setError(error instanceof Error ? error.message : "경로를 내보내지 못했어요."); }
        finally { setBusy(false); }
    }}>이동 경로 GPX 내보내기</TintedButton>{savedTo && <p role="status" className="text-xs mt-2">파일 앱의 나의 iPhone → Run River → {savedTo}에 저장했어요.</p>}{error && <p role="alert" className="text-xs mt-2">{error}</p>}</div>;
}
