"use client";
import dynamic from "next/dynamic";
import {Capacitor} from "@capacitor/core";
import type {MapPack} from "@/lib/offlineMaps";
import type {LatLng, CourseOverlay} from "@/types";

export interface TrailMapProps {
    pack?: MapPack | null;
    overlay?: CourseOverlay;
    currentPosition?: LatLng | null;
    points?: LatLng[];
    course?: LatLng[];
    follow?: boolean;
}
const loading = () => <p role="status">기기에서 지도를 읽는 중…</p>;
const CanvasMap = dynamic(() => import("./CanvasTrailMap"), {ssr: false, loading});
const GLMap = dynamic(() => import("./MapLibreTrailMap"), {ssr: false, loading});
export default function OfflineTrailMap(props: TrailMapProps) {
    const ios = Capacitor.getPlatform() === "ios" || (typeof navigator !== "undefined" &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)));
    return ios ? <CanvasMap {...props} /> : <GLMap {...props} />;
}
