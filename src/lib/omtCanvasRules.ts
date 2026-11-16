import {CenteredTextSymbolizer, LineSymbolizer, PolygonSymbolizer, type LabelRule, type PaintRule} from "protomaps-leaflet";

/**
 * Canvas (Leaflet + protomaps-leaflet) drawing rules for OpenMapTiles-schema tiles from
 * OpenFreeMap, used on iPhone where the WebGL renderer is unreliable. A deliberately small
 * running/hiking style: land, water, roads by class, trails, buildings, place and POI names.
 */
type Feature = {props: Record<string, unknown>};
const cls = (feature: Feature) => String(feature.props.class ?? "");

export function omtCanvasRules(dark: boolean): {paintRules: PaintRule[]; labelRules: LabelRule[]; backgroundColor: string} {
    const c = dark
        ? {bg: "#151a22", green: "#1d2a24", wood: "#1b2a21", urban: "#1b2029", water: "#1d3447", major: "#4a5568", road: "#323a48", minor: "#2a313d", trail: "#c49461", building: "#222936", text: "#d6dbe4", halo: "#0e1117", poi: "#b9c0cc"}
        : {bg: "#f2f0ea", green: "#dfe9d3", wood: "#cfe0c0", urban: "#ebe7df", water: "#aed3e3", major: "#f6d18b", road: "#ffffff", minor: "#ffffff", trail: "#a36b38", building: "#ddd7cd", text: "#2d3340", halo: "#ffffff", poi: "#5e4830"};

    const roadWidth = (base: number) => (zoom: number) => Math.max(0.5, base * Math.pow(1.45, zoom - 14));
    // Hiking paths and tracks only: city footways/sidewalks would cover every street in dashes.
    const isTrail = (_z: number, feature: Feature) => cls(feature) === "track" || (cls(feature) === "path" && ["path", "steps", "bridleway", ""].includes(String(feature.props.subclass ?? "")));

    const paintRules: PaintRule[] = [
        {dataLayer: "landcover", symbolizer: new PolygonSymbolizer({fill: c.green}), filter: (_z, f) => ["grass", "meadow", "scrub", "farmland"].includes(cls(f))},
        {dataLayer: "landcover", symbolizer: new PolygonSymbolizer({fill: c.wood}), filter: (_z, f) => cls(f) === "wood" || cls(f) === "forest"},
        {dataLayer: "park", symbolizer: new PolygonSymbolizer({fill: c.green, opacity: 0.8})},
        {dataLayer: "landuse", symbolizer: new PolygonSymbolizer({fill: c.urban}), filter: (_z, f) => ["residential", "commercial", "industrial", "retail", "school", "university"].includes(cls(f))},
        {dataLayer: "water", symbolizer: new PolygonSymbolizer({fill: c.water})},
        {dataLayer: "waterway", symbolizer: new LineSymbolizer({color: c.water, width: 1.4})},
        {dataLayer: "building", minzoom: 14, symbolizer: new PolygonSymbolizer({fill: c.building, opacity: 0.85})},
        {dataLayer: "transportation", symbolizer: new LineSymbolizer({color: c.minor, width: roadWidth(1.6)}), filter: (_z, f) => ["minor", "service", "tertiary"].includes(cls(f))},
        {dataLayer: "transportation", symbolizer: new LineSymbolizer({color: c.road, width: roadWidth(3)}), filter: (_z, f) => ["primary", "secondary"].includes(cls(f))},
        {dataLayer: "transportation", symbolizer: new LineSymbolizer({color: c.major, width: roadWidth(3.6)}), filter: (_z, f) => ["motorway", "trunk"].includes(cls(f))},
        {dataLayer: "transportation", minzoom: 12, symbolizer: new LineSymbolizer({color: c.trail, width: 1.5, dash: [3, 2], dashColor: c.trail, dashWidth: 1.5}), filter: isTrail},
    ];
    const name = ["name:ko", "name"];
    const labelRules: LabelRule[] = [
        {dataLayer: "place", symbolizer: new CenteredTextSymbolizer({labelProps: name, fill: c.text, stroke: c.halo, width: 2, fontFamily: "sans-serif", fontWeight: 600, fontSize: (z: number) => (z < 11 ? 13 : 12)}),
            filter: (z, f) => ["city", "town", "village", "suburb"].includes(cls(f)) || (z >= 15 && cls(f) === "neighbourhood")},
        // Landmarks useful outdoors (peaks, parks, stations); shops and offices only when zoomed right in.
        {dataLayer: "poi", minzoom: 14, symbolizer: new CenteredTextSymbolizer({labelProps: name, fill: c.poi, stroke: c.halo, width: 2, fontFamily: "sans-serif", fontSize: 11}),
            filter: (z, f) => z >= 17 || ["park", "railway", "bus", "attraction", "campsite", "drinking_water", "toilets", "place_of_worship", "museum", "school", "college"].includes(cls(f)) || Number(f.props.rank ?? 99) <= 3},
        {dataLayer: "mountain_peak", symbolizer: new CenteredTextSymbolizer({labelProps: name, fill: c.poi, stroke: c.halo, width: 2, fontFamily: "sans-serif", fontWeight: 600, fontSize: 12})},
    ];
    return {paintRules, labelRules, backgroundColor: c.bg};
}
