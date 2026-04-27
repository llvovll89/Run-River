"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import type { LatLng } from "@/types";

const START_MARKER_HTML = `
  <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35))">
    <div style="background:#30d158;color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;font-size:11px;font-weight:900;letter-spacing:-0.03em;font-family:-apple-system,sans-serif">출발</div>
    <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #30d158;margin-top:-1px"></div>
  </div>`;

const END_MARKER_HTML = `
  <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35))">
    <div style="background:#ff9f0a;color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;font-size:11px;font-weight:900;letter-spacing:-0.03em;font-family:-apple-system,sans-serif">도착</div>
    <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #ff9f0a;margin-top:-1px"></div>
  </div>`;

const CURRENT_MARKER_HTML = `
  <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:22px;height:22px;border-radius:50%;background:rgba(0,122,255,0.18)"></div>
    <div style="position:absolute;width:15px;height:15px;border-radius:50%;background:rgba(0,122,255,0.25)"></div>
    <div style="width:10px;height:10px;border-radius:50%;background:#007aff;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,122,255,0.6)"></div>
  </div>`;

export interface KakaoMapHandle {
  panTo: (latlng: LatLng) => void;
}

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

const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap({
  center = { lat: 37.5665, lng: 126.978 },
  onMapClick,
  startPoint,
  endPoint,
  currentPosition,
  pathPoints = [],
  showArrivalRadius = false,
  className = "",
}: KakaoMapProps, ref) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);

  useImperativeHandle(ref, () => ({
    panTo(latlng: LatLng) {
      if (!mapInstanceRef.current) return;
      mapInstanceRef.current.panTo(new kakao.maps.LatLng(latlng.lat, latlng.lng));
    },
  }));
  const startOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const endOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const currentOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const polylineRef = useRef<kakao.maps.Polyline | null>(null);
  const circleRef = useRef<kakao.maps.Circle | null>(null);
  const isLoadedRef = useRef(false);
  // onMapClick을 ref로 보관 → initMap의 의존성에서 제거해 스크립트 중복 주입 방지
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const mapInstance = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: 4,
    });

    mapInstanceRef.current = mapInstance;

    // 항상 클릭 리스너 등록 (ref로 최신 핸들러 참조)
    kakao.maps.event.addListener(mapInstance, "click", (e: kakao.maps.MouseEvent) => {
      onMapClickRef.current?.({ lat: e.latLng.getLat(), lng: e.latLng.getLng() });
    });
  }, [center]); // onMapClick 의존성 제거

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

    // 스크립트 중복 주입 방지
    if (document.querySelector('script[src*="dapi.kakao.com"]')) return;

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      kakao.maps.load(() => {
        isLoadedRef.current = true;
        initMap();
      });
    };
    document.head.appendChild(script);
  }, [initMap]);

  // 언마운트 시 mapInstanceRef 초기화 → React StrictMode 이중 마운트 대응
  useEffect(() => {
    return () => {
      mapInstanceRef.current = null;
      isLoadedRef.current = false;
    };
  }, []);

  // 시작 마커
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (startOverlayRef.current) {
      startOverlayRef.current.setMap(null);
      startOverlayRef.current = null;
    }
    if (!startPoint) return;
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(startPoint.lat, startPoint.lng),
      content: START_MARKER_HTML,
      yAnchor: 1,
      map: mapInstanceRef.current,
    });
    startOverlayRef.current = overlay;
  }, [startPoint]);

  // 도착 마커 + 반경 원
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (endOverlayRef.current) {
      endOverlayRef.current.setMap(null);
      endOverlayRef.current = null;
    }
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
    if (!endPoint) return;
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(endPoint.lat, endPoint.lng),
      content: END_MARKER_HTML,
      yAnchor: 1,
      map: mapInstanceRef.current,
    });
    endOverlayRef.current = overlay;

    if (showArrivalRadius) {
      const circle = new kakao.maps.Circle({
        center: new kakao.maps.LatLng(endPoint.lat, endPoint.lng),
        radius: 50,
        strokeWeight: 2,
        strokeColor: "#ff9f0a",
        strokeOpacity: 0.8,
        fillColor: "#ff9f0a",
        fillOpacity: 0.12,
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
    if (currentOverlayRef.current) {
      currentOverlayRef.current.setPosition(latlng);
    } else {
      const overlay = new kakao.maps.CustomOverlay({
        position: latlng,
        content: CURRENT_MARKER_HTML,
        yAnchor: 0.5,
        map: mapInstanceRef.current,
      });
      currentOverlayRef.current = overlay;
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
});

export default KakaoMap;
