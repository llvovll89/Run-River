"use client";

import {useEffect, useImperativeHandle, useRef, useState} from "react";
import * as maplibregl from "maplibre-gl";
import type {GeoJSONSource, Map as MapInstance, StyleSpecification} from "maplibre-gl";
import {Protocol} from "pmtiles";
import {openOfflineMap, type MapPack} from "@/lib/offlineMaps";
import type {LatLng, CourseOverlay} from "@/types";
import {headingCone} from "@/lib/routeGeometry";
import {MAP_COLORS, OPENFREEMAP_FONT, OPENFREEMAP_STYLE, OSM_ATTRIBUTION, TERRAIN_TILES, circleRing, readMapPrefs, writeMapPrefs} from "@/lib/mapBase";
import type {EngineProps} from "./MapView";
import MapControls from "./MapControls";

let protocol: Protocol | null = null;
const PACK_FONT = "Trail Sans";

function packStyle(url: string, bounds: MapPack["bounds"], maxzoom: number, dark: boolean): StyleSpecification {
    const c = dark
        ? {bg: "#151a22", cover: "#1c2a22", use: "#1f2b24", water: "#1d3447", road: "#323a48", trail: "#c49461", building: "#222936", text: "#d6dbe4", halo: "#0e1117", poi: "#b9c0cc"}
        : {bg: "#edf1e9", cover: "#d9e6cc", use: "#c5d9b9", water: "#a9d2dc", road: "#fffdfa", trail: "#a36b38", building: "#c4c9bd", text: "#415541", halo: "#f6f8f3", poi: "#5e4830"};
    return {
        version: 8,
        "font-faces": {[PACK_FONT]: "/fonts/NotoSans-Regular.ttf"},
        sources: {region: {type: "vector", url, bounds, maxzoom}},
        layers: [
            {id: "background", type: "background", paint: {"background-color": c.bg}},
            {id: "landcover", type: "fill", source: "region", "source-layer": "landcover", paint: {"fill-color": c.cover, "fill-opacity": 0.7}},
            {id: "landuse", type: "fill", source: "region", "source-layer": "landuse", paint: {"fill-color": c.use, "fill-opacity": 0.6}},
            {id: "water", type: "fill", source: "region", "source-layer": "water", filter: ["==", ["geometry-type"], "Polygon"], paint: {"fill-color": c.water}},
            {id: "streams", type: "line", source: "region", "source-layer": "water", filter: ["==", ["geometry-type"], "LineString"], paint: {"line-color": c.water, "line-width": 1.2}},
            {id: "roads", type: "line", source: "region", "source-layer": "roads", paint: {"line-color": c.road, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.7, 15, 4]}},
            {id: "trails", type: "line", source: "region", "source-layer": "roads", filter: ["any", ["==", ["get", "kind"], "path"], ["in", ["get", "kind_detail"], ["literal", ["footway", "path", "steps", "track", "pedestrian"]]]], paint: {"line-color": c.trail, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 15, 2.5], "line-dasharray": [2, 1.5]}},
            {id: "buildings", type: "fill", source: "region", "source-layer": "buildings", minzoom: 13, paint: {"fill-color": c.building, "fill-opacity": 0.7}},
            {id: "places", type: "symbol", source: "region", "source-layer": "places", layout: {"text-field": ["coalesce", ["get", "name:ko"], ["get", "name"]], "text-font": [PACK_FONT], "text-size": 12}, paint: {"text-color": c.text, "text-halo-color": c.halo, "text-halo-width": 1.5}},
            {id: "pois", type: "symbol", source: "region", "source-layer": "pois", minzoom: 12, layout: {"text-field": ["coalesce", ["get", "name:ko"], ["get", "name"]], "text-font": [PACK_FONT], "text-size": 11, "text-max-width": 6}, paint: {"text-color": c.poi, "text-halo-color": c.halo, "text-halo-width": 1.5}},
        ],
    };
}

/** Areas saved from the online map carry OpenMapTiles layers; same look as the iPhone canvas rules. */
function omtPackStyle(url: string, bounds: MapPack["bounds"], maxzoom: number, dark: boolean): StyleSpecification {
    const c = dark
        ? {bg: "#151a22", green: "#1d2a24", wood: "#1b2a21", urban: "#1b2029", water: "#1d3447", major: "#4a5568", road: "#323a48", minor: "#2a313d", trail: "#c49461", building: "#222936", text: "#d6dbe4", halo: "#0e1117", poi: "#b9c0cc"}
        : {bg: "#f2f0ea", green: "#dfe9d3", wood: "#cfe0c0", urban: "#ebe7df", water: "#aed3e3", major: "#f6d18b", road: "#ffffff", minor: "#ffffff", trail: "#a36b38", building: "#ddd7cd", text: "#2d3340", halo: "#ffffff", poi: "#5e4830"};
    const cls = ["get", "class"] as const;
    const name = ["coalesce", ["get", "name:ko"], ["get", "name"]];
    const width = (base: number) => ["interpolate", ["exponential", 1.45], ["zoom"], 10, base * 0.25, 14, base, 18, base * 4.4];
    return {
        version: 8,
        "font-faces": {[PACK_FONT]: "/fonts/NotoSans-Regular.ttf"},
        sources: {openmaptiles: {type: "vector", url, bounds, maxzoom}},
        layers: [
            {id: "background", type: "background", paint: {"background-color": c.bg}},
            {id: "landcover", type: "fill", source: "openmaptiles", "source-layer": "landcover", filter: ["in", cls, ["literal", ["grass", "meadow", "scrub", "farmland"]]], paint: {"fill-color": c.green}},
            {id: "wood", type: "fill", source: "openmaptiles", "source-layer": "landcover", filter: ["in", cls, ["literal", ["wood", "forest"]]], paint: {"fill-color": c.wood}},
            {id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: {"fill-color": c.green, "fill-opacity": 0.8}},
            {id: "landuse", type: "fill", source: "openmaptiles", "source-layer": "landuse", filter: ["in", cls, ["literal", ["residential", "commercial", "industrial", "retail", "school", "university"]]], paint: {"fill-color": c.urban}},
            {id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: {"fill-color": c.water}},
            {id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway", paint: {"line-color": c.water, "line-width": 1.4}},
            {id: "building", type: "fill", source: "openmaptiles", "source-layer": "building", minzoom: 14, paint: {"fill-color": c.building, "fill-opacity": 0.85}},
            {id: "road-minor", type: "line", source: "openmaptiles", "source-layer": "transportation", filter: ["in", cls, ["literal", ["minor", "service", "tertiary"]]], layout: {"line-cap": "round", "line-join": "round"}, paint: {"line-color": c.minor, "line-width": width(1.6)}},
            {id: "road", type: "line", source: "openmaptiles", "source-layer": "transportation", filter: ["in", cls, ["literal", ["primary", "secondary"]]], layout: {"line-cap": "round", "line-join": "round"}, paint: {"line-color": c.road, "line-width": width(3)}},
            {id: "road-major", type: "line", source: "openmaptiles", "source-layer": "transportation", filter: ["in", cls, ["literal", ["motorway", "trunk"]]], layout: {"line-cap": "round", "line-join": "round"}, paint: {"line-color": c.major, "line-width": width(3.6)}},
            {id: "trails", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 12,
                filter: ["any", ["==", cls, "track"], ["all", ["==", cls, "path"], ["in", ["coalesce", ["get", "subclass"], ""], ["literal", ["path", "steps", "bridleway", ""]]]]],
                paint: {"line-color": c.trail, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 2.4], "line-dasharray": [2, 1.5]}},
            {id: "places", type: "symbol", source: "openmaptiles", "source-layer": "place", filter: ["in", cls, ["literal", ["city", "town", "village", "suburb", "neighbourhood"]]], layout: {"text-field": name, "text-font": [PACK_FONT], "text-size": 12}, paint: {"text-color": c.text, "text-halo-color": c.halo, "text-halo-width": 1.5}},
            {id: "peaks", type: "symbol", source: "openmaptiles", "source-layer": "mountain_peak", layout: {"text-field": name, "text-font": [PACK_FONT], "text-size": 12}, paint: {"text-color": c.poi, "text-halo-color": c.halo, "text-halo-width": 1.5}},
            {id: "pois", type: "symbol", source: "openmaptiles", "source-layer": "poi", minzoom: 15, layout: {"text-field": name, "text-font": [PACK_FONT], "text-size": 11, "text-max-width": 6}, paint: {"text-color": c.poi, "text-halo-color": c.halo, "text-halo-width": 1.5}},
        ],
    } as StyleSpecification;
}

/** OpenFreeMap styles show Latin names first; show the Korean name when OSM has one. */
function preferKoreanLabels(style: StyleSpecification): StyleSpecification {
    for (const layer of style.layers) {
        if (layer.type !== "symbol" || !layer.layout?.["text-field"]) continue;
        // Only name labels; road shields (ref numbers) and other fields stay as they are.
        if (!JSON.stringify(layer.layout["text-field"]).includes("name")) continue;
        layer.layout["text-field"] = ["coalesce", ["get", "name:ko"], ["get", "name"]];
    }
    return style;
}

const styleCache = new Map<string, Promise<StyleSpecification>>();
function fetchOnlineStyle(dark: boolean): Promise<StyleSpecification> {
    const url = dark ? OPENFREEMAP_STYLE.dark : OPENFREEMAP_STYLE.light;
    let request = styleCache.get(url);
    if (!request) {
        request = fetch(url, {credentials: "omit"}).then(async response => {
            if (!response.ok) throw new Error(`style ${response.status}`);
            return preferKoreanLabels(await response.json() as StyleSpecification);
        });
        request.catch(() => styleCache.delete(url));
        styleCache.set(url, request);
    }
    return request;
}

function emptyStyle(dark: boolean): StyleSpecification {
    return {version: 8, "font-faces": {[PACK_FONT]: "/fonts/NotoSans-Regular.ttf"}, sources: {}, layers: [{id: "background", type: "background", paint: {"background-color": dark ? "#151a22" : "#edf1e9"}}]};
}

const empty = {type: "FeatureCollection" as const, features: []};
const lineFeatures = (path: LatLng[]) => {
    const segments: LatLng[][] = [[]];
    for (const point of path) {
        if ("segment_start" in point && point.segment_start && segments.at(-1)!.length) segments.push([]);
        segments.at(-1)!.push(point);
    }
    return {type: "FeatureCollection" as const, features: segments.filter(s => s.length > 1).map(s => ({type: "Feature" as const, properties: {}, geometry: {type: "LineString" as const, coordinates: s.map(p => [p.lng, p.lat])}}))};
};

function pinElement(kind: "start" | "end" | "preview"): HTMLElement {
    const el = document.createElement("div");
    el.className = `map-pin map-pin-${kind}`;
    el.setAttribute("aria-hidden", "true");
    return el;
}

export default function MapLibreTrailMap(props: EngineProps) {
    const {ref, pack, overlay, currentPosition, points = [], course = [], routePath = [], follow = false, heading = null, base, dark,
        startPoint, endPoint, previewPoint, previewLine = false, showArrivalRadius = false, activityType, showControls = false, controlsTop, testId = "offline-trail-map"} = props;
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapInstance | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");
    const initialCenter = useRef(props.center ?? currentPosition ?? null);
    const fittedOverlay = useRef<CourseOverlay | undefined>(undefined);
    const fittedCourse = useRef<LatLng[] | undefined>(undefined);
    const fittedPoints = useRef(false);
    const markers = useRef<{start?: maplibregl.Marker; end?: maplibregl.Marker; preview?: maplibregl.Marker}>({});
    const [terrain, setTerrain] = useState(false);
    // Latest callbacks without re-creating the map.
    const callbacks = useRef(props);
    callbacks.current = props;

    useImperativeHandle(ref, () => ({
        panTo(latlng: LatLng) { mapRef.current?.easeTo({center: [latlng.lng, latlng.lat], duration: 400}); },
        fitPoints(list: LatLng[]) {
            const map = mapRef.current;
            if (!map || list.length === 0) return;
            const bounds = new maplibregl.LngLatBounds();
            list.forEach(p => bounds.extend([p.lng, p.lat]));
            map.fitBounds(bounds, {padding: {top: 90, right: 40, bottom: 220, left: 40}, maxZoom: 16, duration: 400});
        },
        getBounds() { const b = mapRef.current?.getBounds(); return b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : null; },
    }));

    useEffect(() => { setTerrain(readMapPrefs().terrain); }, []);

    useEffect(() => {
        let disposed = false;
        setLoaded(false); setError("");
        fittedOverlay.current = undefined;
        fittedCourse.current = undefined;
        let protocolKey: string | null = null;
        void (async () => {
            try {
                const archive = base === "pack" && pack ? await openOfflineMap(pack.id) : null;
                // Fetch the online style first: if the network is unusable we fall back before
                // starting the map (and its worker) at all.
                const onlineStyle = base === "online" ? await fetchOnlineStyle(dark) : null;
                if (disposed || !container.current) return;
                protocol ??= new Protocol();
                maplibregl.setWorkerUrl("/map-runtime/maplibre-gl-worker.mjs");
                maplibregl.addProtocol("pmtiles", protocol.tile);
                if (archive) { protocol.add(archive); protocolKey = archive.source.getKey(); }
                const start = initialCenter.current;
                const inside = start && (!pack || contains(pack, start));
                const style = archive && pack ? (pack.schema === "openmaptiles" ? omtPackStyle : packStyle)(`pmtiles://${archive.source.getKey()}`, pack.bounds, pack.maxZoom, dark)
                    : onlineStyle ?? emptyStyle(dark);
                const labelFont = base === "online" ? OPENFREEMAP_FONT : PACK_FONT;
                const map = new maplibregl.Map({
                    container: container.current,
                    style,
                    center: inside ? [start!.lng, start!.lat] : pack ? [(pack.bounds[0] + pack.bounds[2]) / 2, (pack.bounds[1] + pack.bounds[3]) / 2] : [126.978, 37.5665],
                    zoom: props.initialZoom ?? (base === "online" ? 15 : 13), maxZoom: base === "pack" ? Math.min((pack?.maxZoom ?? 17) + 3, 20) : 19,
                    localIdeographFontFamily: "sans-serif", attributionControl: false,
                });
                mapRef.current = map;
                map.addControl(new maplibregl.ScaleControl({unit: "metric"}), "bottom-left");
                map.on("error", event => {
                    if (disposed) return;
                    // A failed online style means no network after all: let MapView fall back.
                    if (base === "online" && !map.isStyleLoaded()) { callbacks.current.onBaseError(); return; }
                    if (base === "pack") setError(`지도를 읽지 못했어요. 파일을 다시 저장해주세요. ${event.error?.message ?? ""}`);
                });
                map.on("dragstart", () => callbacks.current.onUserDrag?.());
                const reportView = () => { const b = map.getBounds(); callbacks.current.onViewChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]); };
                map.on("moveend", reportView);
                map.on("load", () => {
                    if (base === "online") {
                        map.addSource("terrain", {type: "raster-dem", tiles: [TERRAIN_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 15});
                        const firstSymbol = map.getStyle().layers.find(layer => layer.type === "symbol")?.id;
                        map.addLayer({id: "hillshade", type: "hillshade", source: "terrain", layout: {visibility: "none"}, paint: {"hillshade-exaggeration": 0.25, "hillshade-shadow-color": dark ? "#000000" : "#6b7280", "hillshade-highlight-color": dark ? "#2a3344" : "#ffffff"}}, firstSymbol);
                        // Same brown dashed trails as the offline and iPhone maps; the stock style draws them faintly.
                        if (map.getSource("openmaptiles")) map.addLayer({
                            id: "trails", type: "line", source: "openmaptiles", "source-layer": "transportation", minzoom: 12,
                            filter: ["any", ["==", ["get", "class"], "track"], ["all", ["==", ["get", "class"], "path"], ["in", ["coalesce", ["get", "subclass"], ""], ["literal", ["path", "steps", "bridleway", ""]]]]],
                            paint: {"line-color": dark ? "#c49461" : "#a36b38", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 2.4], "line-dasharray": [2, 1.5]},
                        }, firstSymbol);
                    }
                    map.addSource("imported", {type: "geojson", data: empty});
                    map.addLayer({id: "imported-area", type: "fill", source: "imported", filter: ["==", ["geometry-type"], "Polygon"], paint: {"fill-color": "#bf833d", "fill-opacity": 0.2}});
                    map.addLayer({id: "imported-lines", type: "line", source: "imported", filter: ["!=", ["geometry-type"], "Point"], paint: {"line-color": "#a85134", "line-width": 3}});
                    map.addLayer({id: "imported-points", type: "circle", source: "imported", filter: ["==", ["geometry-type"], "Point"], paint: {"circle-color": "#a85134", "circle-radius": 6, "circle-stroke-color": "#fff", "circle-stroke-width": 2}});
                    map.addLayer({id: "imported-names", type: "symbol", source: "imported", filter: ["==", ["geometry-type"], "Point"], layout: {"text-field": ["get", "name"], "text-font": [labelFont], "text-size": 12, "text-offset": [0, 1.4]}, paint: {"text-color": "#6c3924", "text-halo-color": "#fff", "text-halo-width": 1.5}});
                    map.addSource("arrival", {type: "geojson", data: empty});
                    map.addLayer({id: "arrival", type: "fill", source: "arrival", paint: {"fill-color": MAP_COLORS.arrival, "fill-opacity": 0.14}});
                    map.addLayer({id: "arrival-edge", type: "line", source: "arrival", paint: {"line-color": MAP_COLORS.arrival, "line-width": 2, "line-opacity": 0.8}});
                    map.addSource("preview-line", {type: "geojson", data: empty});
                    map.addLayer({id: "preview-line", type: "line", source: "preview-line", paint: {"line-color": MAP_COLORS.preview, "line-width": 3, "line-dasharray": [2, 2]}});
                    map.addSource("route", {type: "geojson", data: empty});
                    map.addLayer({id: "route", type: "line", source: "route", layout: {"line-join": "round", "line-cap": "round"}, paint: {"line-color": dark ? "#7f9cc8" : MAP_COLORS.accent, "line-width": 6, "line-opacity": 0.85}});
                    map.addSource("course", {type: "geojson", data: empty});
                    map.addLayer({id: "course", type: "line", source: "course", paint: {"line-color": MAP_COLORS.course, "line-width": 4, "line-dasharray": [2, 1]}});
                    map.addSource("recorded", {type: "geojson", data: empty});
                    map.addLayer({id: "recorded", type: "line", source: "recorded", layout: {"line-join": "round", "line-cap": "round"}, paint: {"line-color": MAP_COLORS.accent, "line-width": 5}});
                    map.addSource("heading", {type: "geojson", data: empty});
                    map.addLayer({id: "heading", type: "fill", source: "heading", paint: {"fill-color": MAP_COLORS.accent, "fill-opacity": 0.35}});
                    map.addSource("position", {type: "geojson", data: empty});
                    map.addLayer({id: "position", type: "circle", source: "position", paint: {"circle-radius": 7, "circle-color": dark ? "#7f9cc8" : MAP_COLORS.accent, "circle-stroke-color": "white", "circle-stroke-width": 3}});
                    map.on("click", event => {
                        const feature = map.queryRenderedFeatures(event.point, {layers: ["imported-points", "imported-lines", "imported-area"]})[0];
                        if (feature) { new maplibregl.Popup().setLngLat(event.lngLat).setText(String(feature.properties.name || "가져온 표시")).addTo(map); return; }
                        callbacks.current.onMapClick?.({lat: event.lngLat.lat, lng: event.lngLat.lng});
                    });
                    if (!disposed) { setLoaded(true); reportView(); }
                });
            } catch (failure) {
                if (disposed) return;
                if (base === "online") callbacks.current.onBaseError();
                else setError(failure instanceof Error ? failure.message : "지도를 열지 못했어요.");
            }
        })();
        return () => {
            disposed = true;
            Object.values(markers.current).forEach(marker => marker?.remove());
            markers.current = {};
            mapRef.current?.remove(); mapRef.current = null;
            // 전역 protocol이 연 팩(ArrayBuffer 전체)을 계속 붙잡지 않게 해제한다
            if (protocolKey) protocol?.tiles.delete(protocolKey);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pack?.id, base, dark]);

    // Terrain shading follows the saved preference.
    useEffect(() => {
        const map = mapRef.current;
        if (!loaded || !map?.getLayer("hillshade")) return;
        map.setLayoutProperty("hillshade", "visibility", terrain ? "visible" : "none");
    }, [loaded, terrain]);

    // Start / end / preview markers.
    useEffect(() => {
        const map = mapRef.current;
        if (!loaded || !map) return;
        const place = (key: "start" | "end" | "preview", point: LatLng | null | undefined, draggable: boolean, onMove?: (latlng: LatLng) => void) => {
            const existing = markers.current[key];
            if (!point) { existing?.remove(); delete markers.current[key]; return; }
            if (existing) { existing.setLngLat([point.lng, point.lat]); return; }
            const marker = new maplibregl.Marker({element: pinElement(key), draggable, anchor: key === "preview" ? "bottom" : "center"}).setLngLat([point.lng, point.lat]).addTo(map);
            if (onMove) marker.on("dragend", () => { const p = marker.getLngLat(); onMove({lat: p.lat, lng: p.lng}); });
            markers.current[key] = marker;
        };
        place("start", startPoint, true, latlng => callbacks.current.onStartPointChange?.(latlng));
        place("end", endPoint, true, latlng => callbacks.current.onEndPointChange?.(latlng));
        place("preview", previewPoint, false);
    }, [loaded, startPoint, endPoint, previewPoint]);

    useEffect(() => {
        const map = mapRef.current;
        if (!loaded || !map) return;
        const set = (id: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
        set("recorded", lineFeatures(points));
        map.setPaintProperty("recorded", "line-color", activityType === "walking" ? MAP_COLORS.walk : dark ? "#7f9cc8" : MAP_COLORS.accent);
        set("course", lineFeatures(course));
        set("route", lineFeatures(routePath));
        set("preview-line", previewLine && startPoint && endPoint && routePath.length < 2 ? lineFeatures([startPoint, endPoint]) : empty);
        set("arrival", showArrivalRadius && endPoint ? {type: "Feature", properties: {}, geometry: {type: "Polygon", coordinates: [circleRing(endPoint, 5)]}} : empty);
        set("imported", overlay ?? empty);
        if (!follow && overlay && fittedOverlay.current !== overlay) {
            const bounds = new maplibregl.LngLatBounds();
            for (const feature of overlay.features) {
                const positions = feature.geometry.type === "Point" ? [feature.geometry.coordinates] : feature.geometry.type === "LineString" ? feature.geometry.coordinates : feature.geometry.coordinates.flat();
                for (const [lng, lat] of positions) bounds.extend([lng, lat]);
            }
            if (!bounds.isEmpty()) map.fitBounds(bounds, {padding: 40, maxZoom: 16, duration: 0});
            fittedOverlay.current = overlay;
        }
        if (!follow && !overlay && course.length >= 2 && fittedCourse.current !== course) {
            const bounds = new maplibregl.LngLatBounds();
            for (const point of course) bounds.extend([point.lng, point.lat]);
            map.fitBounds(bounds, {padding: 40, maxZoom: 16, duration: 0});
            fittedCourse.current = course;
        }
        set("position", currentPosition ? {type: "Feature", properties: {}, geometry: {type: "Point", coordinates: [currentPosition.lng, currentPosition.lat]}} : empty);
        set("heading", currentPosition && heading !== null ? {type: "Feature", properties: {}, geometry: {type: "Polygon", coordinates: [headingCone(currentPosition, heading).map(p => [p.lng, p.lat])]}} : empty);
        if (props.fitToPoints && !fittedPoints.current && points.length >= 2) {
            const bounds = new maplibregl.LngLatBounds();
            for (const point of points) bounds.extend([point.lng, point.lat]);
            map.fitBounds(bounds, {padding: 28, maxZoom: 17, duration: 0});
            fittedPoints.current = true;
        }
        if (follow && currentPosition && (base !== "pack" || !pack || contains(pack, currentPosition))) map.easeTo({center: [currentPosition.lng, currentPosition.lat], duration: 500});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, points, course, routePath, overlay, currentPosition, follow, pack, heading, base, dark, activityType, previewLine, startPoint, endPoint, showArrivalRadius]);

    const zoomBy = (delta: number) => { const map = mapRef.current; if (map) map.easeTo({zoom: map.getZoom() + delta, duration: 250}); };
    const toggleTerrain = () => setTerrain(previous => { writeMapPrefs({terrain: !previous}); return !previous; });

    return <div className="relative w-full h-full" data-testid={testId} data-map-engine="webgl" data-map-base={base} data-map-ready={loaded && !error ? "true" : "false"}>
        <div ref={container} style={{position: "absolute", inset: 0}} aria-label={base === "pack" ? "저장한 등산 지도" : "지도"} />
        {showControls && loaded && <MapControls top={controlsTop} onZoom={zoomBy} terrain={base === "online" ? {on: terrain, toggle: toggleTerrain} : undefined} />}
        <MapAttribution base={base} pack={pack} />
        {base === "pack" && pack && currentPosition && !contains(pack, currentPosition) && <p role="status" className="map-notice">현재 위치가 저장한 지도 영역 밖이에요.</p>}
        {base === "none" && overlay && <p className="map-notice">배경 지도 없이 가져온 표시를 보여줘요 · 배경 지도는 별도로 저장해주세요</p>}
        {error && <p role="alert" className="map-notice">{error}</p>}
        {!loaded && !error && <p role="status" className="map-notice">{base === "pack" ? "기기에서 지도를 읽는 중…" : "지도를 여는 중…"}</p>}
    </div>;
}

export function MapAttribution({base, pack}: {base: EngineProps["base"]; pack?: MapPack | null}) {
    if (base === "none") return null;
    return <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="map-attribution">{base === "pack" && pack?.schema !== "openmaptiles" ? "© OpenStreetMap · Protomaps" : OSM_ATTRIBUTION}</a>;
}

export function contains(pack: MapPack, point: LatLng) { return point.lng >= pack.bounds[0] && point.lng <= pack.bounds[2] && point.lat >= pack.bounds[1] && point.lat <= pack.bounds[3]; }
