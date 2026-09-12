"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ActivityType, LatLng, TrackPoint } from "@/types";

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
  trackPoints: TrackPoint[];
  totalDistance: number;
  speed: number | null;
  currentAltitude: number | null;
  startAltitude: number | null;
  endAltitude: number | null;
  elevationGain: number;
  elevationLoss: number;
}

interface StartTrackingOptions {
  activityType?: ActivityType;
  restore?: {
    pathPoints: LatLng[];
    trackPoints: TrackPoint[];
    totalDistance: number;
    currentAltitude: number | null;
    startAltitude: number | null;
    endAltitude: number | null;
    elevationGain: number;
    elevationLoss: number;
  };
}

const ALTITUDE_NOISE_THRESHOLD_M = 1.5;

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
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);
  const [startAltitude, setStartAltitude] = useState<number | null>(null);
  const [endAltitude, setEndAltitude] = useState<number | null>(null);
  const [elevationGain, setElevationGain] = useState(0);
  const [elevationLoss, setElevationLoss] = useState(0);
  const [speed, setSpeed] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<LatLng | null>(null);
  const lastPathPointRef = useRef<LatLng | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastSampleTimestampRef = useRef<number | null>(null);
  const elapsedSecondsRef = useRef(0);
  const lastAltitudeRef = useRef<number | null>(null);
  const startAltitudeRef = useRef<number | null>(null);
  const altGainBufferRef = useRef(0);
  const altLossBufferRef = useRef(0);
  const totalDistanceRef = useRef(0);
  const activityTypeRef = useRef<ActivityType>("running");

  const appendTrackPoint = useCallback((point: TrackPoint) => {
    setTrackPoints((prev) => [...prev, point]);
  }, []);

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
        const currentTs = pos.timestamp;
        const prevSampleTs = lastSampleTimestampRef.current;
        if (prevSampleTs !== null) {
          const deltaSeconds = (currentTs - prevSampleTs) / 1000;
          if (deltaSeconds > 0 && Number.isFinite(deltaSeconds)) {
            elapsedSecondsRef.current += deltaSeconds;
          }
        }
        lastSampleTimestampRef.current = currentTs;

        const newPos: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setState((prev) => ({ ...prev, position: newPos }));
        setSpeed(Number.isFinite(pos.coords.speed) ? pos.coords.speed : null);

        const altitude = Number.isFinite(pos.coords.altitude) ? pos.coords.altitude : null;
        setCurrentAltitude(altitude);
        if (altitude !== null) {
          if (startAltitudeRef.current === null) {
            startAltitudeRef.current = altitude;
            setStartAltitude(altitude);
          }
          if (lastAltitudeRef.current !== null) {
            const deltaAltitude = altitude - lastAltitudeRef.current;
            if (deltaAltitude > 0) {
              altGainBufferRef.current += deltaAltitude;
              altLossBufferRef.current = 0;
              if (altGainBufferRef.current >= ALTITUDE_NOISE_THRESHOLD_M) {
                setElevationGain((prev) => prev + altGainBufferRef.current);
                altGainBufferRef.current = 0;
              }
            } else if (deltaAltitude < 0) {
              altLossBufferRef.current += Math.abs(deltaAltitude);
              altGainBufferRef.current = 0;
              if (altLossBufferRef.current >= ALTITUDE_NOISE_THRESHOLD_M) {
                setElevationLoss((prev) => prev + altLossBufferRef.current);
                altLossBufferRef.current = 0;
              }
            }
          }
          lastAltitudeRef.current = altitude;
          setEndAltitude(altitude);
        }

        if (lastPositionRef.current === null) {
          // 최초 포인트: 그대로 앵커로 채택
          appendTrackPoint({
            ...newPos,
            timestamp: currentTs,
            elapsed_seconds: Math.round(elapsedSecondsRef.current),
            distance_km: totalDistanceRef.current,
            altitude_m: altitude,
          });
          lastPositionRef.current = newPos;
          lastTimestampRef.current = currentTs;
        } else if (lastTimestampRef.current === null) {
          // 재개/복원 직후 등 앵커 시각이 없는 상태: 검증 없이 현재 위치로 재앵커링만 수행
          lastPositionRef.current = newPos;
          lastTimestampRef.current = currentTs;
        } else {
          // 거리 누적: 정확도 + 속도 기반 검증 통과 시에만 반영.
          // reject된 포인트는 다음 델타의 기준점으로 삼지 않음 (앵커 오염 방지)
          const dist = calcDistance(lastPositionRef.current, newPos);
          const deltaSeconds = (currentTs - lastTimestampRef.current) / 1000;
          const accuracyMeters = pos.coords.accuracy ?? Number.POSITIVE_INFINITY;

          if (isValidDistancePoint(dist, deltaSeconds, accuracyMeters)) {
            totalDistanceRef.current += dist;
            setTotalDistance(totalDistanceRef.current);
            appendTrackPoint({
              ...newPos,
              timestamp: currentTs,
              elapsed_seconds: Math.round(elapsedSecondsRef.current),
              distance_km: totalDistanceRef.current,
              altitude_m: altitude,
            });

            // 경로 표시용: 5m 이상 이동 시만 추가 (메모리 절감)
            const pathDist = lastPathPointRef.current
              ? calcDistance(lastPathPointRef.current, newPos)
              : Infinity;
            if (pathDist >= 0.005) {
              setPathPoints((prev) => [...prev, newPos]);
              lastPathPointRef.current = newPos;
            }

            lastPositionRef.current = newPos;
            lastTimestampRef.current = currentTs;
          }
        }
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
      setTrackPoints(restore.trackPoints);
      setTotalDistance(restore.totalDistance);
      totalDistanceRef.current = restore.totalDistance;
      elapsedSecondsRef.current = restore.trackPoints.length > 0
        ? restore.trackPoints[restore.trackPoints.length - 1].elapsed_seconds
        : 0;
      setCurrentAltitude(restore.currentAltitude);
      setStartAltitude(restore.startAltitude);
      setEndAltitude(restore.endAltitude);
      setElevationGain(restore.elevationGain);
      setElevationLoss(restore.elevationLoss);
      const restoredLast = restore.pathPoints.length > 0 ? restore.pathPoints[restore.pathPoints.length - 1] : null;
      lastPositionRef.current = restoredLast;
      lastPathPointRef.current = restoredLast;
      lastTimestampRef.current = null;
      lastSampleTimestampRef.current = null;
      lastAltitudeRef.current = restore.endAltitude;
      startAltitudeRef.current = restore.startAltitude;
      altGainBufferRef.current = 0;
      altLossBufferRef.current = 0;
    } else {
      setPathPoints([]);
      setTrackPoints([]);
      setTotalDistance(0);
      totalDistanceRef.current = 0;
      elapsedSecondsRef.current = 0;
      setCurrentAltitude(null);
      setStartAltitude(null);
      setEndAltitude(null);
      setElevationGain(0);
      setElevationLoss(0);
      lastPositionRef.current = null;
      lastPathPointRef.current = null;
      lastTimestampRef.current = null;
      lastSampleTimestampRef.current = null;
      lastAltitudeRef.current = null;
      startAltitudeRef.current = null;
      altGainBufferRef.current = 0;
      altLossBufferRef.current = 0;
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

  // 훅 레벨에서는 stopTracking과 동일한 동작(watch 해제)이며, 재개 가능 여부는 호출부가 관리한다
  const pauseTracking = stopTracking;

  const resumeTracking = useCallback(() => {
    if (!navigator.geolocation) return;
    lastTimestampRef.current = null;
    lastSampleTimestampRef.current = null;
    setState((prev) => ({ ...prev, isTracking: true, error: null }));
    startWatch();
  }, [startWatch]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && watchIdRef.current !== null) {
        lastPositionRef.current = null;
        lastTimestampRef.current = null;
        lastSampleTimestampRef.current = null;
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
    trackPoints,
    totalDistance,
    speed,
    currentAltitude,
    startAltitude,
    endAltitude,
    elevationGain,
    elevationLoss,
  };
}

export { calcDistance };
