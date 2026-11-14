"use client";

import {useState} from "react";
import type {LatLng, TrackPoint} from "@/types";
import {buildGpx} from "@/lib/hiking";
import TintedButton from "@/components/TintedButton";

export default function ExportGpxButton({name, points}: {name: string; points: (LatLng & Partial<TrackPoint>)[]}) {
    const [error, setError] = useState("");
    if (!points.length) return null;
    return <div className="mt-3"><TintedButton tone="neutral" onClick={() => {
        try {
            const url = URL.createObjectURL(new Blob([buildGpx(name, points)], {type: "application/gpx+xml;charset=utf-8"}));
            const link = document.createElement("a"); link.href = url; link.download = `run-river-${new Date().toISOString().slice(0, 10)}.gpx`;
            link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setError("");
        } catch (error) { setError(error instanceof Error ? error.message : "경로를 내보내지 못했어요."); }
    }}>이동 경로 GPX 내보내기</TintedButton>{error && <p role="alert" className="text-xs mt-2">{error}</p>}</div>;
}
