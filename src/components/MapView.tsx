"use client";

import dynamic from "next/dynamic";
import {useEffect, useState, type Ref} from "react";
import {Capacitor} from "@capacitor/core";
import OfflineRoute from "@/components/OfflineRoute";
import {useTheme} from "@/hooks/useTheme";
import {prefersCanvasMap} from "@/lib/mapBase";
import type {MapPack} from "@/lib/offlineMaps";
import type {ActivityType, CourseOverlay, LatLng} from "@/types";

export interface MapHandle {
    panTo: (latlng: LatLng) => void;
    /** Zoom and pan so every point is visible. */
    fitPoints: (points: LatLng[]) => void;
    /** Visible area as [west, south, east, north], once the map exists. */
    getBounds: () => [number, number, number, number] | null;
}

/** What every screen can ask of the map, whichever engine draws it. */
export interface MapViewProps {
    ref?: Ref<MapHandle>;
    /** Saved offline map. Without it the online OpenFreeMap base is used when there is a connection. */
    pack?: MapPack | null;
    /** Imported KMZ/KML/GPX features. */
    overlay?: CourseOverlay;
    /** Course to follow (dashed). */
    course?: LatLng[];
    /** Recorded track (solid, activity color). Points with `segment_start` break the line. */
    points?: LatLng[];
    activityType?: ActivityType | "hiking";
    /** Frame the whole recorded track once it is available (result screens). */
    fitToPoints?: boolean;
    /** Planned walking route (solid accent). */
    routePath?: LatLng[];
    currentPosition?: LatLng | null;
    heading?: number | null;
    follow?: boolean;
    onUserDrag?: () => void;
    /** Called after the map opens and whenever panning/zooming ends, with [west, south, east, north]. */
    onViewChange?: (bounds: [number, number, number, number]) => void;
    /** Test hook for the map element (defaults to "offline-trail-map"). */
    testId?: string;
    center?: LatLng;
    /** Opening zoom level (engines pick one by base map otherwise). */
    initialZoom?: number;
    startPoint?: LatLng | null;
    endPoint?: LatLng | null;
    onStartPointChange?: (latlng: LatLng) => void;
    onEndPointChange?: (latlng: LatLng) => void;
    onMapClick?: (latlng: LatLng) => void;
    /** Dashed straight line start→end while no route is known. */
    previewLine?: boolean;
    previewPoint?: LatLng | null;
    showArrivalRadius?: boolean;
    /** Zoom and terrain buttons. */
    showControls?: boolean;
    controlsTop?: string;
    /** With no saved map and no connection: draw the GPS sketch instead of an empty map. */
    offlineSketch?: boolean;
    offlineRouteTop?: string;
    className?: string;
}

/** Props an engine receives: the base map has been decided for it. */
export interface EngineProps extends MapViewProps {
    base: "pack" | "online" | "none";
    dark: boolean;
    onBaseError: () => void;
}

const loading = () => <p role="status" className="absolute top-3 left-3 rounded-xl p-2 text-xs" style={{background: "var(--c-surface)"}}>지도를 여는 중…</p>;
const CanvasMap = dynamic(() => import("./CanvasTrailMap"), {ssr: false, loading});
const GLMap = dynamic(() => import("./MapLibreTrailMap"), {ssr: false, loading});

/**
 * One map for every screen. Base: saved pack → OpenFreeMap online → GPS sketch/background.
 * Engine: MapLibre (WebGL) everywhere except iPhone, which uses Leaflet canvas.
 */
export default function MapView(props: MapViewProps) {
    const {pack, offlineSketch = false, className = ""} = props;
    const {theme} = useTheme();
    const [online, setOnline] = useState(true);
    const [baseFailed, setBaseFailed] = useState(false);
    const [canvas, setCanvas] = useState<boolean | null>(null);

    useEffect(() => {
        setCanvas(prefersCanvasMap(Capacitor.getPlatform() === "ios"));
        const update = () => { setOnline(navigator.onLine); if (navigator.onLine) setBaseFailed(false); };
        update();
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
    }, []);

    const base: EngineProps["base"] = pack ? "pack" : online && !baseFailed ? "online" : "none";
    const sketch = base === "none" && offlineSketch && !props.overlay;
    const Engine = canvas ? CanvasMap : GLMap;

    return <div className={`relative w-full ${className}`}>
        {canvas !== null && !sketch && <div className="absolute inset-0">
            <Engine key={`${base}-${theme}`} {...props} base={base} dark={theme === "dark"} onBaseError={() => setBaseFailed(true)} />
        </div>}
        {sketch && <OfflineRoute top={props.offlineRouteTop} points={props.points ?? []} currentPosition={props.currentPosition ?? props.points?.at(-1) ?? props.startPoint} />}
    </div>;
}
