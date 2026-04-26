"use client";

import { useEffect, useRef, useCallback } from "react";
import type { LatLng } from "@/types";

interface KakaoMapProps {
  center?: LatLng;
  onMapClick?: (latlng: LatLng) => void;
  startPoint?: LatLng | null;
  endPoint?: LatLng | null;
  currentPosition?: LatLng | null;
  pathPoints?: LatLng[];
  showArrivalRadius?: boolean;
  className?: string;
}

export default function KakaoMap({
  center = { lat: 37.5665, lng: 126.978 },
  onMapClick,
  startPoint,
  endPoint,
  currentPosition,
  pathPoints = [],
  showArrivalRadius = false,
  className = "",
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);
  const startMarkerRef = useRef<kakao.maps.Marker | null>(null);
  const endMarkerRef = useRef<kakao.maps.Marker | null>(null);
  const currentMarkerRef = useRef<kakao.maps.Marker | null>(null);
  const polylineRef = useRef<kakao.maps.Polyline | null>(null);
  const circleRef = useRef<kakao.maps.Circle | null>(null);
  const isLoadedRef = useRef(false);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const mapInstance = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: 4,
    });

    mapInstanceRef.current = mapInstance;

    if (onMapClick) {
      kakao.maps.event.addListener(mapInstance, "click", (e: kakao.maps.MouseEvent) => {
        onMapClick({ lat: e.latLng.getLat(), lng: e.latLng.getLng() });
      });
    }
  }, [center, onMapClick]);

  useEffect(() => {
    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!kakaoKey) return;

    if (window.kakao?.maps) {
      if (!isLoadedRef.current) {
        isLoadedRef.current = true;
        initMap();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false`;
    script.async = true;
    script.onload = () => {
      kakao.maps.load(() => {
        isLoadedRef.current = true;
        initMap();
      });
    };
    document.head.appendChild(script);
  }, [initMap]);

  // 시작 마커
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (startMarkerRef.current) {
      startMarkerRef.current.setMap(null);
      startMarkerRef.current = null;
    }
    if (!startPoint) return;

    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(startPoint.lat, startPoint.lng),
    });
    marker.setMap(mapInstanceRef.current);
    startMarkerRef.current = marker;
  }, [startPoint]);

  // 도착 마커 + 반경 원
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (endMarkerRef.current) {
      endMarkerRef.current.setMap(null);
      endMarkerRef.current = null;
    }
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
    if (!endPoint) return;

    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(endPoint.lat, endPoint.lng),
    });
    marker.setMap(mapInstanceRef.current);
    endMarkerRef.current = marker;

    if (showArrivalRadius) {
      const circle = new kakao.maps.Circle({
        center: new kakao.maps.LatLng(endPoint.lat, endPoint.lng),
        radius: 50,
        strokeWeight: 2,
        strokeColor: "#ef4444",
        strokeOpacity: 0.8,
        fillColor: "#ef4444",
        fillOpacity: 0.15,
        map: mapInstanceRef.current,
      });
      circleRef.current = circle;
    }
  }, [endPoint, showArrivalRadius]);

  // 현재 위치 마커
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!currentPosition) return;

    const latlng = new kakao.maps.LatLng(currentPosition.lat, currentPosition.lng);

    if (currentMarkerRef.current) {
      currentMarkerRef.current.setPosition(latlng);
    } else {
      const marker = new kakao.maps.Marker({ position: latlng });
      marker.setMap(mapInstanceRef.current);
      currentMarkerRef.current = marker;
    }

    mapInstanceRef.current.panTo(latlng);
  }, [currentPosition]);

  // 이동 경로 폴리라인
  useEffect(() => {
    if (!mapInstanceRef.current || pathPoints.length < 2) return;

    const path = pathPoints.map((p) => new kakao.maps.LatLng(p.lat, p.lng));

    if (polylineRef.current) {
      polylineRef.current.setPath(path);
    } else {
      const polyline = new kakao.maps.Polyline({
        path,
        strokeWeight: 4,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.9,
        strokeStyle: "solid",
        map: mapInstanceRef.current,
      });
      polylineRef.current = polyline;
    }
  }, [pathPoints]);

  return <div ref={mapRef} className={`w-full ${className}`} />;
}
