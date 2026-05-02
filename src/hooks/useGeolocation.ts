"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ActivityType, LatLng } from "@/types";

interface GeolocationState {
  position: LatLng | null;
  error: string | null;
  isTracking: boolean;
}

interface UseGeolocationReturn extends GeolocationState {
  startTracking: (options?: StartTrackingOptions) => void;
  stopTracking: () => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  pathPoints: LatLng[];
  totalDistance: number;
}

interface StartTrackingOptions {
  activityType?: ActivityType;
  restore?: {
    pathPoints: LatLng[];
    totalDistance: number;
  };
}

function calcDistance(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useGeolocation(): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    isTracking: false,
  });
  const [pathPoints, setPathPoints] = useState<LatLng[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<LatLng | null>(null);
  const lastPathPointRef = useRef<LatLng | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const activityTypeRef = useRef<ActivityType>("running");

  const isValidDistancePoint = useCallback((distanceKm: number, deltaSeconds: number, accuracyMeters: number): boolean => {
    if (distanceKm < 0.001) return false;
    if (distanceKm > 0.05) return false;
    if (!Number.isFinite(accuracyMeters) || accuracyMeters > 40) return false;
    if (deltaSeconds <= 0) return false;

    const speedKmh = (distanceKm / deltaSeconds) * 3600;
    const maxSpeed = activityTypeRef.current === "running" ? 25 : 9;
    return speedKmh <= maxSpeed;
  }, []);

  const startWatch = useCallback(() => {
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setState((prev) => ({ ...prev, position: newPos }));

        // 거리 누적: 정확도 + 속도 기반 검증 통과 시에만 반영
        if (lastPositionRef.current) {
          const dist = calcDistance(lastPositionRef.current, newPos);
          const currentTs = pos.timestamp;
          const prevTs = lastTimestampRef.current ?? currentTs;
          const deltaSeconds = (currentTs - prevTs) / 1000;
          const accuracyMeters = pos.coords.accuracy ?? Number.POSITIVE_INFINITY;

          if (isValidDistancePoint(dist, deltaSeconds, accuracyMeters)) {
            setTotalDistance((prev) => prev + dist);

            // 경로 표시용: 5m 이상 이동 시만 추가 (메모리 절감)
            const pathDist = lastPathPointRef.current
              ? calcDistance(lastPathPointRef.current, newPos)
              : Infinity;
            if (pathDist >= 0.005) {
              setPathPoints((prev) => [...prev, newPos]);
              lastPathPointRef.current = newPos;
            }
          }
        }
        lastPositionRef.current = newPos;
        lastTimestampRef.current = pos.timestamp;
      },
      (err) => {
        setState((prev) => ({ ...prev, error: err.message }));
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }, []);

  const startTracking = useCallback((options?: StartTrackingOptions) => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: "GPS를 지원하지 않는 기기입니다." }));
      return;
    }

    const restore = options?.restore;
    activityTypeRef.current = options?.activityType ?? "running";

    if (restore) {
      setPathPoints(restore.pathPoints);
      setTotalDistance(restore.totalDistance);
      const restoredLast = restore.pathPoints.length > 0 ? restore.pathPoints[restore.pathPoints.length - 1] : null;
      lastPositionRef.current = restoredLast;
      lastPathPointRef.current = restoredLast;
      lastTimestampRef.current = null;
    } else {
      setPathPoints([]);
      setTotalDistance(0);
      lastPositionRef.current = null;
      lastPathPointRef.current = null;
      lastTimestampRef.current = null;
    }

    setState((prev) => ({ ...prev, isTracking: true, error: null }));
    startWatch();
  }, [startWatch]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  const pauseTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  const resumeTracking = useCallback(() => {
    if (!navigator.geolocation) return;
    lastTimestampRef.current = null;
    setState((prev) => ({ ...prev, isTracking: true, error: null }));
    startWatch();
  }, [startWatch]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && watchIdRef.current !== null) {
        lastPositionRef.current = null;
        lastTimestampRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    pathPoints,
    totalDistance,
  };
}

export { calcDistance };
