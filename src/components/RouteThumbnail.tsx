import type {LatLng} from "@/types";
import {samplePath} from "@/lib/routeGeometry";

/** Small offline sketch of a recorded route (no map tiles needed). */
export default function RouteThumbnail({points, size = 52}: {points: LatLng[]; size?: number}) {
    const coordinates = samplePath(points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)), 120);
    if (coordinates.length < 2) return <span className="record-thumb" aria-hidden="true" />;
    const cosLat = Math.max(0.01, Math.cos(coordinates[0].lat * Math.PI / 180));
    const xs = coordinates.map(p => p.lng * cosLat), ys = coordinates.map(p => -p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 0.0002);
    const pad = 8, inner = size - pad * 2;
    const project = (i: number) => [
        pad + inner / 2 + ((xs[i] - (minX + maxX) / 2) / span) * inner,
        pad + inner / 2 + ((ys[i] - (minY + maxY) / 2) / span) * inner,
    ];
    const line = coordinates.map((_, i) => project(i).join(",")).join(" ");
    const [sx, sy] = project(0), [ex, ey] = project(coordinates.length - 1);
    return <svg className="record-thumb" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={sx} cy={sy} r="2.6" fill="var(--c-walk)" />
        <circle cx={ex} cy={ey} r="3" fill="currentColor" stroke="var(--c-surface)" strokeWidth="1.2" />
    </svg>;
}
