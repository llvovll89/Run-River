"use client";

import {useEffect, useRef, useState} from "react";
import * as maplibregl from "maplibre-gl";
import type {GeoJSONSource, Map as MapInstance, StyleSpecification} from "maplibre-gl";
import {Protocol} from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import {openOfflineMap, type MapPack} from "@/lib/offlineMaps";
import type {LatLng} from "@/types";

let protocol: Protocol | null = null;
function style(url: string, bounds: MapPack["bounds"], maxzoom: number): StyleSpecification {
    return {
        version: 8,
        "font-faces": {"Trail Sans": "/fonts/NotoSans-Regular.ttf"},
        sources: {region: {type: "vector", url, bounds, maxzoom}},
        layers: [
            {id: "background", type: "background", paint: {"background-color": "#edf1e9"}},
            {id: "landcover", type: "fill", source: "region", "source-layer": "landcover", paint: {"fill-color": "#d9e6cc", "fill-opacity": 0.7}},
            {id: "landuse", type: "fill", source: "region", "source-layer": "landuse", paint: {"fill-color": "#c5d9b9", "fill-opacity": 0.6}},
            {id: "water", type: "fill", source: "region", "source-layer": "water", filter: ["==", ["geometry-type"], "Polygon"], paint: {"fill-color": "#a9d2dc"}},
            {id: "streams", type: "line", source: "region", "source-layer": "water", filter: ["==", ["geometry-type"], "LineString"], paint: {"line-color": "#8ebdcd", "line-width": 1.2}},
            {id: "roads", type: "line", source: "region", "source-layer": "roads", paint: {"line-color": "#fffdfa", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.7, 15, 4]}},
            {id: "trails", type: "line", source: "region", "source-layer": "roads", filter: ["any", ["==", ["get", "kind"], "path"], ["in", ["get", "kind_detail"], ["literal", ["footway", "path", "steps", "track", "pedestrian"]]]], paint: {"line-color": "#a36b38", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 15, 2.5], "line-dasharray": [2, 1.5]}},
            {id: "buildings", type: "fill", source: "region", "source-layer": "buildings", minzoom: 13, paint: {"fill-color": "#c4c9bd", "fill-opacity": 0.7}},
            {id: "places", type: "symbol", source: "region", "source-layer": "places", layout: {"text-field": ["coalesce", ["get", "name:ko"], ["get", "name"]], "text-font": ["Trail Sans"], "text-size": 12}, paint: {"text-color": "#415541", "text-halo-color": "#f6f8f3", "text-halo-width": 1.5}},
            {id: "pois", type: "symbol", source: "region", "source-layer": "pois", minzoom: 12, layout: {"text-field": ["coalesce", ["get", "name:ko"], ["get", "name"]], "text-font": ["Trail Sans"], "text-size": 11, "text-max-width": 6}, paint: {"text-color": "#5e4830", "text-halo-color": "#fff", "text-halo-width": 1.5}},
        ],
    };
}

export default function OfflineTrailMap({pack, currentPosition, points = [], course = [], follow = false}: {pack: MapPack; currentPosition?: LatLng | null; points?: LatLng[]; course?: LatLng[]; follow?: boolean}) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapInstance | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");
    const initialPosition = useRef(currentPosition);

    useEffect(() => {
        let disposed = false;
        setLoaded(false); setError("");
        void (async () => {
            try {
                const archive = await openOfflineMap(pack.id);
                if (disposed || !container.current) return;
                protocol ??= new Protocol();
                maplibregl.setWorkerUrl("/map-runtime/maplibre-gl-worker.mjs");
                maplibregl.addProtocol("pmtiles", protocol.tile);
                protocol.add(archive);
                const inside = initialPosition.current && contains(pack, initialPosition.current);
                const map = new maplibregl.Map({
                    container: container.current,
                    style: style(`pmtiles://${archive.source.getKey()}`, pack.bounds, pack.maxZoom),
                    center: inside ? [initialPosition.current!.lng, initialPosition.current!.lat] : [(pack.bounds[0] + pack.bounds[2]) / 2, (pack.bounds[1] + pack.bounds[3]) / 2],
                    zoom: 13, maxZoom: Math.min(pack.maxZoom + 3, 20), localIdeographFontFamily: "sans-serif", attributionControl: false,
                });
                mapRef.current = map;
                map.addControl(new maplibregl.NavigationControl({showCompass: true}), "top-right");
                map.addControl(new maplibregl.ScaleControl({unit: "metric"}), "bottom-left");
                map.on("error", event => { if (!disposed) setError(`지도를 읽지 못했어요. 파일을 다시 저장해주세요. ${event.error?.message ?? ""}`); });
                map.on("load", () => {
                    map.addSource("recorded", {type: "geojson", data: {type: "FeatureCollection", features: []}});
                    map.addLayer({id: "recorded", type: "line", source: "recorded", paint: {"line-color": "#216d74", "line-width": 4}});
                    map.addSource("course", {type: "geojson", data: {type: "FeatureCollection", features: []}});
                    map.addLayer({id: "course", type: "line", source: "course", paint: {"line-color": "#a85139", "line-width": 3, "line-dasharray": [2, 1]}});
                    map.addSource("position", {type: "geojson", data: {type: "FeatureCollection", features: []}});
                    map.addLayer({id: "position", type: "circle", source: "position", paint: {"circle-radius": 7, "circle-color": "#216d74", "circle-stroke-color": "white", "circle-stroke-width": 3}});
                    if (!disposed) setLoaded(true);
                });
            } catch (error) { if (!disposed) setError(error instanceof Error ? error.message : "지도를 열지 못했어요."); }
        })();
        return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
    }, [pack.id]);

    useEffect(() => {
        const map = mapRef.current;
        if (!loaded || !map) return;
        const line = (id: string, path: LatLng[]) => {
            const segments: LatLng[][] = [[]];
            for (const point of path) {
                if ("segment_start" in point && point.segment_start && segments.at(-1)!.length) segments.push([]);
                segments.at(-1)!.push(point);
            }
            (map.getSource(id) as GeoJSONSource)?.setData({type: "FeatureCollection", features: segments.filter(segment => segment.length > 1).map(segment => ({type: "Feature", properties: {}, geometry: {type: "LineString", coordinates: segment.map(point => [point.lng, point.lat])}}))});
        };
        line("recorded", points); line("course", course);
        (map.getSource("position") as GeoJSONSource)?.setData({type: "FeatureCollection", features: currentPosition ? [{type: "Feature", properties: {}, geometry: {type: "Point", coordinates: [currentPosition.lng, currentPosition.lat]}}] : []});
        if (follow && currentPosition && contains(pack, currentPosition)) map.easeTo({center: [currentPosition.lng, currentPosition.lat], duration: 500});
    }, [loaded, points, course, currentPosition, follow, pack]);

    return <div className="relative w-full h-full" data-testid="offline-trail-map" data-map-ready={loaded && !error ? "true" : "false"}>
        <div ref={container} style={{position: "absolute", inset: 0}} aria-label="저장한 등산 지도" />
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-0 right-0 px-2 text-[10px]" style={{background: "#ffffffdd", color: "#234"}}>© OpenStreetMap · Protomaps</a>
        {currentPosition && !contains(pack, currentPosition) && <p role="status" className="absolute top-2 left-2 right-12 rounded-xl bg-white p-2 text-xs">현재 위치가 저장한 지도 영역 밖이에요.</p>}
        {error && <p role="alert" className="absolute top-2 left-2 right-2 rounded-xl bg-white p-3 text-xs">{error}</p>}
        {!loaded && !error && <p role="status" className="absolute top-3 left-3 rounded-xl bg-white p-2 text-xs">기기에서 지도를 읽는 중…</p>}
    </div>;
}

export function contains(pack: MapPack, point: LatLng) { return point.lng >= pack.bounds[0] && point.lng <= pack.bounds[2] && point.lat >= pack.bounds[1] && point.lat <= pack.bounds[3]; }
