import type {LatLng} from "@/types";
import {calcDistance} from "@/hooks/useGeolocation";

/** Total length of a polyline in km. */
export function pathLengthKm(path: LatLng[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i += 1) total += calcDistance(path[i - 1], path[i]);
    return total;
}

/**
 * How far is left along `path` from `position`: snap to the nearest vertex, then walk to the end.
 * Returns null when the position is too far from the route for the number to mean anything.
 */
export function remainingAlongPath(position: LatLng, path: LatLng[], maxOffRouteKm = 0.2): {remainingKm: number; totalKm: number; offRouteKm: number} | null {
    if (path.length < 2) return null;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < path.length; i += 1) {
        const d = calcDistance(position, path[i]);
        if (d < nearestDistance) { nearestDistance = d; nearest = i; }
    }
    if (nearestDistance > maxOffRouteKm) return null;
    let remainingKm = nearest < path.length - 1 ? 0 : nearestDistance;
    for (let i = nearest + 1; i < path.length; i += 1) remainingKm += calcDistance(path[i - 1], path[i]);
    return {remainingKm, totalKm: pathLengthKm(path), offRouteKm: nearestDistance};
}

/** Evenly pick at most `count` points along a path (by index), always keeping both ends. */
export function samplePath(path: LatLng[], count: number): LatLng[] {
    if (path.length <= count) return path;
    const step = (path.length - 1) / (count - 1);
    return Array.from({length: count}, (_, i) => path[Math.round(i * step)]);
}

/** A small view cone ahead of `position` pointing at `headingDeg` (0 = north), as [lat, lng] pairs. */
export function headingCone(position: LatLng, headingDeg: number, lengthM = 30, spreadDeg = 22): LatLng[] {
    const metersPerDegLat = 111_320;
    const metersPerDegLng = metersPerDegLat * Math.max(0.01, Math.cos(position.lat * Math.PI / 180));
    const tip = (angle: number) => {
        const rad = angle * Math.PI / 180;
        return {lat: position.lat + (Math.cos(rad) * lengthM) / metersPerDegLat, lng: position.lng + (Math.sin(rad) * lengthM) / metersPerDegLng};
    };
    return [position, tip(headingDeg - spreadDeg), tip(headingDeg), tip(headingDeg + spreadDeg), position];
}
