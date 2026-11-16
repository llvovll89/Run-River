import type {LatLng} from "@/types";
import {calcDistance} from "@/hooks/useGeolocation";
import {samplePath} from "@/lib/routeGeometry";
import {withTimeout} from "@/lib/withTimeout";

export interface ElevationProfile {
    /** Distance from the start (km) and elevation (m) for each sample. */
    points: {distanceKm: number; elevationM: number}[];
    gainM: number;
    lossM: number;
    minM: number;
    maxM: number;
}

const MAX_SAMPLES = 80; // Open-Meteo accepts up to 100 coordinates per request.
const cache = new Map<string, ElevationProfile>();

/**
 * Elevation along a planned route from the free Open-Meteo elevation API (no key, ~90m DEM).
 * Only sampled coordinates of the route are sent. Resolves null when offline or on failure.
 */
export async function fetchRouteElevation(path: LatLng[]): Promise<ElevationProfile | null> {
    if (path.length < 2 || typeof navigator !== "undefined" && !navigator.onLine) return null;
    const samples = samplePath(path, MAX_SAMPLES);
    const key = samples.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");
    const cached = cache.get(key);
    if (cached) return cached;
    try {
        const url = new URL("https://api.open-meteo.com/v1/elevation");
        url.searchParams.set("latitude", samples.map(p => p.lat.toFixed(5)).join(","));
        url.searchParams.set("longitude", samples.map(p => p.lng.toFixed(5)).join(","));
        const response = await withTimeout(fetch(url, {credentials: "omit"}), 6000);
        if (!response.ok) return null;
        const data = await response.json() as {elevation?: number[]};
        const elevations = data.elevation;
        if (!Array.isArray(elevations) || elevations.length !== samples.length) return null;

        const points: ElevationProfile["points"] = [];
        let distanceKm = 0, gainM = 0, lossM = 0;
        // Ignore sub-2m wiggles so DEM noise does not inflate the climb.
        let reference = elevations[0];
        elevations.forEach((elevationM, i) => {
            if (i > 0) distanceKm += calcDistance(samples[i - 1], samples[i]);
            points.push({distanceKm, elevationM});
            const delta = elevationM - reference;
            if (Math.abs(delta) >= 2) { if (delta > 0) gainM += delta; else lossM -= delta; reference = elevationM; }
        });
        const profile = {points, gainM, lossM, minM: Math.min(...elevations), maxM: Math.max(...elevations)};
        cache.set(key, profile);
        return profile;
    } catch {
        return null;
    }
}
