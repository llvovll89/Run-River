"use client";

import {useEffect, useState} from "react";
import type {LatLng} from "@/types";
import {fetchRouteElevation, type ElevationProfile} from "@/lib/elevation";

/** Compact elevation profile with total climb/descent for a planned route. */
export default function RouteElevation({path}: {path: LatLng[]}) {
    const [state, setState] = useState<{status: "loading" | "ready" | "unavailable"; profile?: ElevationProfile}>({status: "loading"});

    useEffect(() => {
        let alive = true;
        setState({status: "loading"});
        void fetchRouteElevation(path).then(profile => {
            if (alive) setState(profile ? {status: "ready", profile} : {status: "unavailable"});
        });
        return () => { alive = false; };
    }, [path]);

    if (state.status === "unavailable") return null;
    if (state.status === "loading" || !state.profile) {
        return <p className="route-elevation-note" aria-live="polite">고도 정보를 불러오는 중…</p>;
    }
    const {points, gainM, lossM, minM, maxM} = state.profile;
    const totalKm = points.at(-1)?.distanceKm || 1;
    const range = Math.max(maxM - minM, 10);
    const W = 300, H = 48;
    const line = points.map(p => `${(p.distanceKm / totalKm) * W},${H - 4 - ((p.elevationM - minM) / range) * (H - 8)}`).join(" ");
    return <figure className="route-elevation" aria-label={`경로 고도: 오르막 ${Math.round(gainM)}m, 내리막 ${Math.round(lossM)}m, 최고 ${Math.round(maxM)}m`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <polygon points={`0,${H} ${line} ${W},${H}`} fill="var(--c-accent-text)" opacity=".14" />
            <polyline points={line} fill="none" stroke="var(--c-accent-text)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
        <figcaption>
            <span>오르막 <strong className="num">{Math.round(gainM)}m</strong></span>
            <span>내리막 <strong className="num">{Math.round(lossM)}m</strong></span>
            <span>최고 <strong className="num">{Math.round(maxM)}m</strong></span>
        </figcaption>
    </figure>;
}
