"use client";

/** Zoom and (where supported) terrain shading buttons, stacked on the map's right edge. */
export default function MapControls({top = "calc(var(--sat) + 76px)", onZoom, terrain}: {
    top?: string;
    onZoom: (delta: number) => void;
    terrain?: {on: boolean; toggle: () => void};
}) {
    return <div className="map-controls" style={{top}}>
        {terrain && <div className="map-control-group" role="group" aria-label="지도 표시">
            <button type="button" aria-pressed={terrain.on} onClick={terrain.toggle} title="산 지형 음영">지형</button>
        </div>}
        <div className="map-control-group" role="group" aria-label="확대 축소">
            <button type="button" aria-label="지도 확대" onClick={() => onZoom(1)}>+</button>
            <button type="button" aria-label="지도 축소" onClick={() => onZoom(-1)}>−</button>
        </div>
    </div>;
}
