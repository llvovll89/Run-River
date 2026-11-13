"use client";

import type {LatLng} from "@/types";

export default function OfflineRoute({points, currentPosition, top}: {points: LatLng[]; currentPosition?: LatLng | null; top?: string}) {
    const route = currentPosition ? [...points, currentPosition] : points;
    const coordinates = route.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const latitude = coordinates[0]?.lat ?? 37;
    const cosLat = Math.max(0.01, Math.cos(latitude * Math.PI / 180));
    const xs = coordinates.map((point) => point.lng * cosLat);
    const ys = coordinates.map((point) => -point.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 0.0003);
    const project = (point: LatLng) => ({
        x: 160 + ((point.lng * cosLat - (minX + maxX) / 2) / span) * 240,
        y: 160 + ((-point.lat - (minY + maxY) / 2) / span) * 240,
    });
    const path = coordinates.map(project);
    const last = path.at(-1);
    return (
        <div data-testid="offline-route" className="absolute inset-0 flex flex-col items-center justify-center" style={{background: "var(--c-bg)", color: "var(--c-text-2)"}}>
            <div className="absolute inset-x-0 flex flex-col items-center" style={{top: top ?? "8%", bottom: top ? "18%" : "8%"}}>
            <svg viewBox="0 0 320 320" className="w-full flex-1 min-h-0 max-w-[360px]" role="img" aria-label="GPS 이동 궤적">
                <defs><pattern id="route-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" opacity="0.12" /></pattern></defs>
                <rect width="320" height="320" fill="url(#route-grid)" />
                <polyline points={path.map(({x, y}) => `${x},${y}`).join(" ")} fill="none" stroke="#216d74" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
                {path[0] && <circle cx={path[0].x} cy={path[0].y} r="5" fill="#627c50" />}
                {last && <circle cx={last.x} cy={last.y} r="7" fill="#216d74" stroke="white" strokeWidth="2" />}
            </svg>
            <p className="text-xs px-5 text-center">지도 배경 없이 GPS 이동 궤적을 표시해요</p>
            {top && <p className="text-xs px-5 mt-1 text-center">화면을 켜두세요. 화면 잠금 중에는 기록이 끊길 수 있어요.</p>}
            </div>
        </div>
    );
}
