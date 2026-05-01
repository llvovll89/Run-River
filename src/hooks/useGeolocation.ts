"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { LatLng } from "@/types";

interface GeolocationState {
  position: LatLng | null;
  error: string | null;
  isTracking: boolean;
}

interface UseGeolocationReturn extends GeolocationState {
  startTracking: () => void;
  stopTracking: () => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  pathPoints: LatLng[];
  totalDistance: number;
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

  const startWatch = useCallback(() => {
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setState((prev) => ({ ...prev, position: newPos }));

        // 거리 누적: 1m~50m 이동만 (노이즈·점프 필터)
        if (lastPositionRef.current) {
          const dist = calcDistance(lastPositionRef.current, newPos);
          if (dist > 0.001 && dist < 0.05) {
            setTotalDistance((prev) => prev + dist);
          }
        }
        lastPositionRef.current = newPos;

        // 경로 표시용: 5m 이상 이동 시만 추가 (메모리 절감)
        const pathDist = lastPathPointRef.current
          ? calcDistance(lastPathPointRef.current, newPos)
          : Infinity;
        if (pathDist >= 0.005) {
          setPathPoints((prev) => [...prev, newPos]);
          lastPathPointRef.current = newPos;
        }
      },
      (err) => {
        setState((prev) => ({ ...prev, error: err.message }));
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: "GPS를 지원하지 않는 기기입니다." }));
      return;
    }
    setPathPoints([]);
    setTotalDistance(0);
    lastPositionRef.current = null;
    lastPathPointRef.current = null;
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
    setState((prev) => ({ ...prev, isTracking: true, error: null }));
    startWatch();
  }, [startWatch]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && watchIdRef.current !== null) {
        lastPositionRef.current = null;
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
