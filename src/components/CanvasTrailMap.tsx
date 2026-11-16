"use client";

import {useEffect, useRef, useState} from "react";
import * as L from "leaflet";
import {leafletLayer, LineSymbolizer, type LeafletLayerOptions} from "protomaps-leaflet";
import "leaflet/dist/leaflet.css";
import {openOfflineMap, type MapPack} from "@/lib/offlineMaps";
import type {LatLng, CourseOverlay} from "@/types";
import type {TrailMapProps} from "./OfflineTrailMap";
import {headingCone} from "@/lib/routeGeometry";

const inside = (pack: MapPack, point: LatLng) => point.lng >= pack.bounds[0] && point.lng <= pack.bounds[2] && point.lat >= pack.bounds[1] && point.lat <= pack.bounds[3];

// Canvas tiles and paths avoid WKWebView's WebGL surface/context lifecycle.
// The archive still reads bounded byte ranges from the same native map files.
export default function CanvasTrailMap({pack, overlay, currentPosition, points = [], course = [], follow = false, heading = null}: TrailMapProps) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layers = useRef<{imported: L.FeatureGroup; recorded: L.FeatureGroup; course: L.FeatureGroup; position: L.FeatureGroup} | null>(null);
    const initialPosition = useRef(currentPosition);
    const fittedOverlay = useRef<CourseOverlay | undefined>(undefined);
    const fittedCourse = useRef<LatLng[] | undefined>(undefined);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let disposed = false;
        let observer: ResizeObserver | undefined;
        setLoaded(false); setError("");
        fittedOverlay.current = undefined; fittedCourse.current = undefined;
        void (async () => {
            try {
                const archive = pack ? await openOfflineMap(pack.id) : null;
                const header = await archive?.getHeader();
                if (disposed || !container.current) return;
                (window as unknown as {L: typeof L}).L = L;
                const start = initialPosition.current && (!pack || inside(pack, initialPosition.current)) ? initialPosition.current : pack ? {lat: (pack.bounds[1] + pack.bounds[3]) / 2, lng: (pack.bounds[0] + pack.bounds[2]) / 2} : {lat: 37.66, lng: 126.98};
                const map = L.map(container.current, {center: [start.lat, start.lng], zoom: 14, minZoom: header ? header.minZoom + 1 : 3, maxZoom: Math.min((pack?.maxZoom ?? 17) + 3, 20), preferCanvas: true, attributionControl: false, zoomControl: false, zoomAnimation: false, fadeAnimation: false});
                mapRef.current = map;
                L.control.zoom({position: "topright"}).addTo(map);
                L.control.scale({imperial: false}).addTo(map);
                layers.current = {imported: L.featureGroup().addTo(map), recorded: L.featureGroup().addTo(map), course: L.featureGroup().addTo(map), position: L.featureGroup().addTo(map)};
                if (archive && pack) {
                    const getZxy = archive.getZxy.bind(archive);
                    archive.getZxy = async (...args: Parameters<typeof getZxy>) => {
                        try { return await getZxy(...args); }
                        catch (failure) { if (!disposed) setError(failure instanceof Error ? failure.message : "지도 파일을 읽지 못했어요."); throw failure; }
                    };
                    const base = leafletLayer({
                        // PMTiles 3 and 4 share this archive API; no URL fetch is used.
                        url: archive as unknown as LeafletLayerOptions["url"], flavor: "light", lang: "ko", maxDataZoom: pack.maxZoom,
                        bounds: [[pack.bounds[1], pack.bounds[0]], [pack.bounds[3], pack.bounds[2]]], noWrap: true, keepBuffer: 1, updateWhenIdle: true, devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
                    });
                    base.paintRules.push({dataLayer: "roads", filter: (_zoom, feature) => feature.props.kind === "path" || ["footway", "path", "steps", "track", "pedestrian"].includes(String(feature.props.kind_detail)), symbolizer: new LineSymbolizer({color: "#a36b38", width: 1.6, dash: [3, 2], dashColor: "#a36b38", dashWidth: 1.6})});
                    base.on("load", () => { if (!disposed) setLoaded(true); });
                    base.on("tileerror", () => { if (!disposed) setError("지도 타일을 읽지 못했어요. 파일을 다시 저장해주세요."); });
                    base.addTo(map);
                } else { setLoaded(true); }
                observer = new ResizeObserver(() => map.invalidateSize({animate: false}));
                observer.observe(container.current);
                map.invalidateSize({animate: false});
            } catch (failure) { if (!disposed) setError(failure instanceof Error ? failure.message : "지도를 열지 못했어요."); }
        })();
        return () => { disposed = true; observer?.disconnect(); mapRef.current?.remove(); mapRef.current = null; layers.current = null; };
    }, [pack?.id]);

    useEffect(() => {
        const map = mapRef.current, groups = layers.current;
        if (!loaded || !map || !groups) return;
        groups.imported.clearLayers(); groups.recorded.clearLayers(); groups.course.clearLayers(); groups.position.clearLayers();
        if (overlay) L.geoJSON(overlay, {
            style: {color: "#d58b3b", weight: 3, fillColor: "#d58b3b", fillOpacity: 0.14},
            pointToLayer: (_feature, position) => L.circleMarker(position, {radius: 6, color: "#875719", weight: 2, fillColor: "#e4a44b", fillOpacity: 1}),
            onEachFeature: (feature, layer) => { const text = document.createElement("span"); text.textContent = String(feature.properties?.name || "가져온 표시"); layer.bindPopup(text); },
        }).addTo(groups.imported);
        const line = (values: LatLng[], target: L.FeatureGroup, color: string, dash?: string) => {
            let segment: L.LatLngTuple[] = [];
            const draw = () => { if (segment.length > 1) L.polyline(segment, {color, weight: 4, dashArray: dash}).addTo(target); };
            for (const point of values) {
                if ((point as LatLng & {segment_start?: boolean}).segment_start) { draw(); segment = []; }
                segment.push([point.lat, point.lng]);
            }
            draw();
        };
        line(points, groups.recorded, "#2f4766"); line(course, groups.course, "#276e9a", "5 4");
        if (currentPosition && heading !== null) L.polygon(headingCone(currentPosition, heading).map(p => [p.lat, p.lng] as [number, number]), {stroke: false, fillColor: "#2f4766", fillOpacity: 0.35}).addTo(groups.position);
        if (currentPosition) L.circleMarker([currentPosition.lat, currentPosition.lng], {radius: 7, color: "white", weight: 3, fillColor: "#2f4766", fillOpacity: 1}).addTo(groups.position);
        if (!follow && overlay && fittedOverlay.current !== overlay) {
            const bounds = groups.imported.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds, {padding: [40, 40], maxZoom: 16, animate: false});
            fittedOverlay.current = overlay;
        } else if (!follow && !overlay && course.length >= 2 && fittedCourse.current !== course) {
            map.fitBounds(L.latLngBounds(course.map(point => [point.lat, point.lng] as L.LatLngTuple)), {padding: [40, 40], maxZoom: 16, animate: false});
            fittedCourse.current = course;
        }
        if (follow && currentPosition && (!pack || inside(pack, currentPosition))) map.panTo([currentPosition.lat, currentPosition.lng], {animate: false});
    }, [loaded, points, course, overlay, currentPosition, follow, pack, heading]);

    return <div className="relative w-full h-full" style={{isolation: "isolate"}} data-testid="offline-trail-map" data-map-engine="canvas" data-map-ready={loaded && !error ? "true" : "false"}>
        <div ref={container} style={{position: "absolute", inset: 0, background: "#edf1e9", zIndex: 0}} aria-label="저장한 등산 지도" />
        {pack ? <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-0 right-0 px-2 text-[10px]" style={{zIndex: 500, background: "#ffffffdd", color: "#234"}}>© OpenStreetMap · Protomaps</a> : <p className="absolute top-2 left-2 right-12 rounded-lg bg-white p-2 text-[10px]" style={{zIndex: 500}}>배경 지도 없이 가져온 표시를 보여줘요 · 배경 지도는 별도로 저장해주세요.</p>}
        {pack && currentPosition && !inside(pack, currentPosition) && <p role="status" className="absolute top-2 left-2 right-12 rounded-xl bg-white p-2 text-xs" style={{zIndex: 500}}>현재 위치가 저장한 지도 영역 밖이에요.</p>}
        {error && <p role="alert" className="absolute top-2 left-2 right-2 rounded-xl bg-white p-3 text-xs" style={{zIndex: 500}}>{error}</p>}
        {!loaded && !error && <p role="status" className="absolute top-3 left-3 rounded-xl bg-white p-2 text-xs" style={{zIndex: 500}}>기기에서 지도를 읽는 중…</p>}
    </div>;
}
