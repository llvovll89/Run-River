"use client";

import {useEffect, useImperativeHandle, useRef, useState} from "react";
import * as L from "leaflet";
import {leafletLayer, LineSymbolizer, type LeafletLayerOptions} from "protomaps-leaflet";
import {openOfflineMap, type MapPack} from "@/lib/offlineMaps";
import type {LatLng, CourseOverlay} from "@/types";
import {headingCone} from "@/lib/routeGeometry";
import {MAP_COLORS, openFreeMapTileTemplate} from "@/lib/mapBase";
import {omtCanvasRules} from "@/lib/omtCanvasRules";
import type {EngineProps} from "./MapView";
import MapControls from "./MapControls";
import {MapAttribution} from "./MapLibreTrailMap";

const inside = (pack: MapPack, point: LatLng) => point.lng >= pack.bounds[0] && point.lng <= pack.bounds[2] && point.lat >= pack.bounds[1] && point.lat <= pack.bounds[3];
const pin = (kind: "start" | "end" | "preview") => L.divIcon({className: `map-pin map-pin-${kind}`, iconSize: kind === "preview" ? [30, 38] : [30, 30], iconAnchor: kind === "preview" ? [15, 38] : [15, 15]});

// Canvas tiles and paths avoid WKWebView's WebGL surface/context lifecycle.
// Offline packs read bounded byte ranges from the native map files; online tiles come from OpenFreeMap.
export default function CanvasTrailMap(props: EngineProps) {
    const {ref, pack, overlay, currentPosition, points = [], course = [], routePath = [], follow = false, heading = null, base, dark,
        startPoint, endPoint, previewPoint, previewLine = false, showArrivalRadius = false, activityType, showControls = false, controlsTop, testId = "offline-trail-map"} = props;
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layers = useRef<{imported: L.FeatureGroup; recorded: L.FeatureGroup; course: L.FeatureGroup; position: L.FeatureGroup} | null>(null);
    const markers = useRef<{start?: L.Marker; end?: L.Marker; preview?: L.Marker}>({});
    const initialCenter = useRef(props.center ?? currentPosition ?? null);
    const fittedOverlay = useRef<CourseOverlay | undefined>(undefined);
    const fittedCourse = useRef<LatLng[] | undefined>(undefined);
    const fittedPoints = useRef(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");
    const callbacks = useRef(props);
    callbacks.current = props;

    useImperativeHandle(ref, () => ({
        panTo(latlng: LatLng) { mapRef.current?.panTo([latlng.lat, latlng.lng]); },
        fitPoints(list: LatLng[]) {
            if (!mapRef.current || list.length === 0) return;
            mapRef.current.fitBounds(L.latLngBounds(list.map(p => [p.lat, p.lng] as L.LatLngTuple)), {paddingTopLeft: [40, 90], paddingBottomRight: [40, 220], maxZoom: 16});
        },
        getBounds() { const b = mapRef.current?.getBounds(); return b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : null; },
    }));

    useEffect(() => {
        let disposed = false;
        let observer: ResizeObserver | undefined;
        setLoaded(false); setError("");
        fittedOverlay.current = undefined; fittedCourse.current = undefined;
        void (async () => {
            try {
                const archive = base === "pack" && pack ? await openOfflineMap(pack.id) : null;
                const header = await archive?.getHeader();
                const template = base === "online" ? await openFreeMapTileTemplate() : null;
                if (disposed || !container.current) return;
                (window as unknown as {L: typeof L}).L = L;
                const s = initialCenter.current;
                const start = s && (!pack || base !== "pack" || inside(pack, s)) ? s : pack ? {lat: (pack.bounds[1] + pack.bounds[3]) / 2, lng: (pack.bounds[0] + pack.bounds[2]) / 2} : {lat: 37.5665, lng: 126.978};
                const map = L.map(container.current, {
                    center: [start.lat, start.lng], zoom: props.initialZoom ?? (base === "online" ? 15 : 14), minZoom: header ? header.minZoom + 1 : 3,
                    maxZoom: base === "pack" ? Math.min((pack?.maxZoom ?? 17) + 3, 20) : 18,
                    preferCanvas: true, attributionControl: false, zoomControl: false, zoomAnimation: false, fadeAnimation: false,
                });
                mapRef.current = map;
                L.control.scale({imperial: false}).addTo(map);
                layers.current = {imported: L.featureGroup().addTo(map), recorded: L.featureGroup().addTo(map), course: L.featureGroup().addTo(map), position: L.featureGroup().addTo(map)};
                map.on("dragstart", () => callbacks.current.onUserDrag?.());
                const reportView = () => { const b = map.getBounds(); callbacks.current.onViewChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]); };
                map.on("moveend", reportView);
                map.on("click", event => callbacks.current.onMapClick?.({lat: event.latlng.lat, lng: event.latlng.lng}));
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                if (archive && pack) {
                    const getZxy = archive.getZxy.bind(archive);
                    archive.getZxy = async (...args: Parameters<typeof getZxy>) => {
                        try { return await getZxy(...args); }
                        catch (failure) { if (!disposed) setError(failure instanceof Error ? failure.message : "지도 파일을 읽지 못했어요."); throw failure; }
                    };
                    const omt = pack.schema === "openmaptiles" ? omtCanvasRules(dark) : null;
                    const layer = leafletLayer({
                        // PMTiles 3 and 4 share this archive API; no URL fetch is used.
                        url: archive as unknown as LeafletLayerOptions["url"], ...(omt ?? {flavor: dark ? "dark" : "light", lang: "ko"}), maxDataZoom: pack.maxZoom,
                        bounds: [[pack.bounds[1], pack.bounds[0]], [pack.bounds[3], pack.bounds[2]]], noWrap: true, keepBuffer: 1, updateWhenIdle: true, devicePixelRatio: dpr,
                    });
                    if (!omt) layer.paintRules.push({dataLayer: "roads", filter: (_zoom, feature) => feature.props.kind === "path" || ["footway", "path", "steps", "track", "pedestrian"].includes(String(feature.props.kind_detail)), symbolizer: new LineSymbolizer({color: "#a36b38", width: 1.6, dash: [3, 2], dashColor: "#a36b38", dashWidth: 1.6})});
                    layer.on("load", () => { if (!disposed) setLoaded(true); });
                    layer.on("tileerror", () => { if (!disposed) setError("지도 타일을 읽지 못했어요. 파일을 다시 저장해주세요."); });
                    layer.addTo(map);
                } else if (template) {
                    const rules = omtCanvasRules(dark);
                    // Online tiles are decoded and painted on the main thread: keep the work small so the
                    // page stays responsive (1.5x canvas, no off-screen buffer, no redraw while zooming).
                    const layer = leafletLayer({url: template, paintRules: rules.paintRules, labelRules: rules.labelRules, backgroundColor: rules.backgroundColor, maxDataZoom: 14,
                        keepBuffer: 0, updateWhenIdle: true, updateWhenZooming: false, devicePixelRatio: Math.min(dpr, 1.5)});
                    layer.on("load", () => { if (!disposed) setLoaded(true); });
                    layer.addTo(map);
                    // Tiles render lazily; the map itself is usable right away.
                    setLoaded(true);
                } else { setLoaded(true); }
                observer = new ResizeObserver(() => map.invalidateSize({animate: false}));
                observer.observe(container.current);
                map.invalidateSize({animate: false});
                reportView();
            } catch (failure) {
                if (disposed) return;
                if (base === "online") callbacks.current.onBaseError();
                else setError(failure instanceof Error ? failure.message : "지도를 열지 못했어요.");
            }
        })();
        return () => {
            disposed = true; observer?.disconnect();
            markers.current = {};
            mapRef.current?.remove(); mapRef.current = null; layers.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pack?.id, base, dark]);

    useEffect(() => {
        const map = mapRef.current;
        if (!loaded || !map) return;
        const place = (key: "start" | "end" | "preview", point: LatLng | null | undefined, draggable: boolean, onMove?: (latlng: LatLng) => void) => {
            const existing = markers.current[key];
            if (!point) { existing?.remove(); delete markers.current[key]; return; }
            if (existing) { existing.setLatLng([point.lat, point.lng]); return; }
            const marker = L.marker([point.lat, point.lng], {icon: pin(key), draggable, keyboard: false}).addTo(map);
            if (onMove) marker.on("dragend", () => { const p = marker.getLatLng(); onMove({lat: p.lat, lng: p.lng}); });
            markers.current[key] = marker;
        };
        place("start", startPoint, true, latlng => callbacks.current.onStartPointChange?.(latlng));
        place("end", endPoint, true, latlng => callbacks.current.onEndPointChange?.(latlng));
        place("preview", previewPoint, false);
    }, [loaded, startPoint, endPoint, previewPoint]);

    useEffect(() => {
        const map = mapRef.current, groups = layers.current;
        if (!loaded || !map || !groups) return;
        groups.imported.clearLayers(); groups.recorded.clearLayers(); groups.course.clearLayers(); groups.position.clearLayers();
        if (overlay) L.geoJSON(overlay, {
            style: {color: "#d58b3b", weight: 3, fillColor: "#d58b3b", fillOpacity: 0.14},
            pointToLayer: (_feature, position) => L.circleMarker(position, {radius: 6, color: "#875719", weight: 2, fillColor: "#e4a44b", fillOpacity: 1}),
            onEachFeature: (feature, layer) => { const text = document.createElement("span"); text.textContent = String(feature.properties?.name || "가져온 표시"); layer.bindPopup(text); },
        }).addTo(groups.imported);
        const line = (values: LatLng[], target: L.FeatureGroup, options: L.PolylineOptions) => {
            let segment: L.LatLngTuple[] = [];
            const draw = () => { if (segment.length > 1) L.polyline(segment, options).addTo(target); };
            for (const point of values) {
                if ((point as LatLng & {segment_start?: boolean}).segment_start) { draw(); segment = []; }
                segment.push([point.lat, point.lng]);
            }
            draw();
        };
        const accent = dark ? "#7f9cc8" : MAP_COLORS.accent;
        if (showArrivalRadius && endPoint) L.circle([endPoint.lat, endPoint.lng], {radius: 5, color: MAP_COLORS.arrival, weight: 2, fillColor: MAP_COLORS.arrival, fillOpacity: 0.12}).addTo(groups.course);
        if (previewLine && startPoint && endPoint && routePath.length < 2) line([startPoint, endPoint], groups.course, {color: MAP_COLORS.preview, weight: 3, dashArray: "6 6"});
        line(routePath, groups.course, {color: accent, weight: 6, opacity: 0.85});
        line(course, groups.course, {color: MAP_COLORS.course, weight: 4, dashArray: "5 4"});
        line(points, groups.recorded, {color: activityType === "walking" ? MAP_COLORS.walk : accent, weight: 5});
        if (currentPosition && heading !== null) L.polygon(headingCone(currentPosition, heading).map(p => [p.lat, p.lng] as [number, number]), {stroke: false, fillColor: MAP_COLORS.accent, fillOpacity: 0.35}).addTo(groups.position);
        if (currentPosition) L.circleMarker([currentPosition.lat, currentPosition.lng], {radius: 7, color: "white", weight: 3, fillColor: accent, fillOpacity: 1}).addTo(groups.position);
        if (!follow && overlay && fittedOverlay.current !== overlay) {
            const bounds = groups.imported.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds, {padding: [40, 40], maxZoom: 16, animate: false});
            fittedOverlay.current = overlay;
        } else if (!follow && !overlay && course.length >= 2 && fittedCourse.current !== course) {
            map.fitBounds(L.latLngBounds(course.map(point => [point.lat, point.lng] as L.LatLngTuple)), {padding: [40, 40], maxZoom: 16, animate: false});
            fittedCourse.current = course;
        }
        if (props.fitToPoints && !fittedPoints.current && points.length >= 2) {
            map.fitBounds(L.latLngBounds(points.map(point => [point.lat, point.lng] as L.LatLngTuple)), {padding: [28, 28], maxZoom: 17, animate: false});
            fittedPoints.current = true;
        }
        if (follow && currentPosition && (base !== "pack" || !pack || inside(pack, currentPosition))) map.panTo([currentPosition.lat, currentPosition.lng], {animate: false});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, points, course, routePath, overlay, currentPosition, follow, pack, heading, base, dark, activityType, previewLine, startPoint, endPoint, showArrivalRadius]);

    const zoomBy = (delta: number) => { const map = mapRef.current; if (map) map.setZoom(map.getZoom() + delta); };

    return <div className="relative w-full h-full" style={{isolation: "isolate"}} data-testid={testId} data-map-engine="canvas" data-map-base={base} data-map-ready={loaded && !error ? "true" : "false"}>
        <div ref={container} style={{position: "absolute", inset: 0, background: dark ? "#151a22" : "#edf1e9", zIndex: 0}} aria-label={base === "pack" ? "저장한 등산 지도" : "지도"} />
        {showControls && loaded && <MapControls top={controlsTop} onZoom={zoomBy} />}
        <MapAttribution base={base} pack={pack} />
        {base === "pack" && pack && currentPosition && !inside(pack, currentPosition) && <p role="status" className="map-notice">현재 위치가 저장한 지도 영역 밖이에요.</p>}
        {base === "none" && overlay && <p className="map-notice">배경 지도 없이 가져온 표시를 보여줘요 · 배경 지도는 별도로 저장해주세요.</p>}
        {error && <p role="alert" className="map-notice">{error}</p>}
        {!loaded && !error && <p role="status" className="map-notice">{base === "pack" ? "기기에서 지도를 읽는 중…" : "지도를 여는 중…"}</p>}
    </div>;
}
