"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import type { LatLng, ActivityType } from "@/types";

// 출발 마커 — 에메랄드 그라디언트 핀, 플레이 아이콘
const _startSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="62"><defs><linearGradient id="sg" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#4ade80"/><stop offset="100%" stop-color="#059669"/></linearGradient><radialGradient id="shl" cx="38%" cy="30%" r="60%"><stop offset="0%" stop-color="white" stop-opacity="0.38"/><stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient><filter id="ssf" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#064e3b" flood-opacity="0.5"/></filter></defs><g filter="url(#ssf)"><circle cx="26" cy="22" r="20" fill="url(#sg)"/><circle cx="26" cy="22" r="20" fill="url(#shl)"/><polygon points="20,41 26,54 32,41" fill="url(#sg)"/><circle cx="26" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2"/></g><polygon points="22,15 22,23 30,19" fill="white" opacity="0.92"/><text x="26" y="32.5" text-anchor="middle" fill="white" font-size="9.5" font-weight="800" font-family="-apple-system,BlinkMacSystemFont,sans-serif">출발</text></svg>';
const START_MARKER_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(_startSvg)}`;

// 도착 마커 — 앰버→오렌지 그라디언트 핀, 체크 아이콘
const _endSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="62"><defs><linearGradient id="eg" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f97316"/></linearGradient><radialGradient id="ehl" cx="38%" cy="30%" r="60%"><stop offset="0%" stop-color="white" stop-opacity="0.38"/><stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient><filter id="esf" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#7c2d12" flood-opacity="0.5"/></filter></defs><g filter="url(#esf)"><circle cx="26" cy="22" r="20" fill="url(#eg)"/><circle cx="26" cy="22" r="20" fill="url(#ehl)"/><polygon points="20,41 26,54 32,41" fill="url(#eg)"/><circle cx="26" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2"/></g><path d="M19,21 L23.5,26.5 L33,15" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/><text x="26" y="35" text-anchor="middle" fill="white" font-size="9.5" font-weight="800" font-family="-apple-system,BlinkMacSystemFont,sans-serif">도착</text></svg>';
const END_MARKER_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(_endSvg)}`;

function buildCurrentMarkerHTML(heading: number | null): string {
  const cone = heading !== null
    ? `<svg style="position:absolute;top:0;left:0;width:44px;height:44px;transform:rotate(${heading}deg);transform-origin:50% 50%" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg"><path d="M22,22 L17,10 Q22,4 27,10 Z" fill="#007aff" opacity="0.82"/></svg>`
    : "";
  return `<div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">${cone}<div style="position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(0,122,255,0.15)"></div><div style="position:absolute;width:16px;height:16px;border-radius:50%;background:rgba(0,122,255,0.22)"></div><div style="width:11px;height:11px;border-radius:50%;background:#007aff;border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,122,255,0.7);position:relative;z-index:1"></div></div>`;
}

// 미리보기 핀 마커 — 슬레이트 그라디언트
const _previewSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="54"><defs><linearGradient id="pg" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#475569"/></linearGradient><radialGradient id="phl" cx="38%" cy="30%" r="60%"><stop offset="0%" stop-color="white" stop-opacity="0.35"/><stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient><filter id="psf" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.4"/></filter></defs><g filter="url(#psf)"><circle cx="22" cy="19" r="16" fill="url(#pg)"/><circle cx="22" cy="19" r="16" fill="url(#phl)"/><polygon points="17,33 22,44 27,33" fill="url(#pg)"/><circle cx="22" cy="19" r="16" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/></g><circle cx="22" cy="19" r="5" fill="white" opacity="0.9"/></svg>';
const PREVIEW_MARKER_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(_previewSvg)}`;

export interface KakaoMapHandle {
  panTo: (latlng: LatLng) => void;
}

interface KakaoMapProps {
  center?: LatLng;
  onMapClick?: (latlng: LatLng) => void;
  onStartPointChange?: (latlng: LatLng) => void;
  onEndPointChange?: (latlng: LatLng) => void;
  startPoint?: LatLng | null;
  endPoint?: LatLng | null;
  currentPosition?: LatLng | null;
  heading?: number | null;
  pathPoints?: LatLng[];
  routePath?: LatLng[];
  showArrivalRadius?: boolean;
  previewLine?: boolean;
  previewPoint?: LatLng | null;
  activityType?: ActivityType;
  followUser?: boolean;
  onUserDrag?: () => void;
  className?: string;
}

const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap({
  center = { lat: 37.5665, lng: 126.978 },
  onMapClick,
  onStartPointChange,
  onEndPointChange,
  startPoint,
  endPoint,
  currentPosition,
  heading = null,
  pathPoints = [],
  routePath = [],
  showArrivalRadius = false,
  previewLine = false,
  previewPoint = null,
  activityType = "running",
  followUser = false,
  onUserDrag,
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
  const startMarkerRef   = useRef<kakao.maps.Marker | null>(null);
  const endMarkerRef     = useRef<kakao.maps.Marker | null>(null);
  const previewMarkerRef = useRef<kakao.maps.Marker | null>(null);
  const currentOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const polylineRef = useRef<kakao.maps.Polyline | null>(null);
  const previewLineRef = useRef<kakao.maps.Polyline | null>(null);
  const routeLineRef = useRef<kakao.maps.Polyline | null>(null);
  const circleRef = useRef<kakao.maps.Circle | null>(null);
  const isLoadedRef = useRef(false);
  // callback refs → 의존성 배열에서 제외
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  const onStartPointChangeRef = useRef(onStartPointChange);
  useEffect(() => { onStartPointChangeRef.current = onStartPointChange; }, [onStartPointChange]);
  const onEndPointChangeRef = useRef(onEndPointChange);
  useEffect(() => { onEndPointChangeRef.current = onEndPointChange; }, [onEndPointChange]);
  const onUserDragRef = useRef(onUserDrag);
  useEffect(() => { onUserDragRef.current = onUserDrag; }, [onUserDrag]);

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
    kakao.maps.event.addListener(mapInstance, "dragstart", () => {
      onUserDragRef.current?.();
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

  // 시작 마커 (드래그 가능)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!startPoint) {
      if (startMarkerRef.current) { startMarkerRef.current.setMap(null); startMarkerRef.current = null; }
      return;
    }
    const latlng = new kakao.maps.LatLng(startPoint.lat, startPoint.lng);
    if (startMarkerRef.current) {
      startMarkerRef.current.setPosition(latlng);
      return;
    }
    const startImage = new kakao.maps.MarkerImage(START_MARKER_SRC, new kakao.maps.Size(52, 62), { offset: new kakao.maps.Point(26, 60) });
    const startM = new kakao.maps.Marker({ position: latlng, image: startImage, draggable: true, map: mapInstanceRef.current });
    kakao.maps.event.addListener(startM, "dragend", () => {
      const pos = startM.getPosition();
      onStartPointChangeRef.current?.({ lat: pos.getLat(), lng: pos.getLng() });
    });
    startMarkerRef.current = startM;
  }, [startPoint]);

  // 도착 마커 (드래그 가능) + 반경 원
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (circleRef.current) { circleRef.current.setMap(null); circleRef.current = null; }
    if (!endPoint) {
      if (endMarkerRef.current) { endMarkerRef.current.setMap(null); endMarkerRef.current = null; }
      return;
    }
    const latlng = new kakao.maps.LatLng(endPoint.lat, endPoint.lng);
    if (endMarkerRef.current) {
      endMarkerRef.current.setPosition(latlng);
    } else {
      const endImage = new kakao.maps.MarkerImage(END_MARKER_SRC, new kakao.maps.Size(52, 62), { offset: new kakao.maps.Point(26, 60) });
      const endM = new kakao.maps.Marker({ position: latlng, image: endImage, draggable: true, map: mapInstanceRef.current });
      kakao.maps.event.addListener(endM, "dragend", () => {
        const pos = endM.getPosition();
        onEndPointChangeRef.current?.({ lat: pos.getLat(), lng: pos.getLng() });
      });
      endMarkerRef.current = endM;
    }
    if (showArrivalRadius) {
      const circle = new kakao.maps.Circle({
        center: latlng, radius: 5,
        strokeWeight: 2, strokeColor: "#ff9f0a", strokeOpacity: 0.8,
        fillColor: "#ff9f0a", fillOpacity: 0.12, map: mapInstanceRef.current,
      });
      circleRef.current = circle;
    }
  }, [endPoint, showArrivalRadius]);

  // 현재 위치 마커
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!currentPosition) return;
    const latlng = new kakao.maps.LatLng(currentPosition.lat, currentPosition.lng);
    const html = buildCurrentMarkerHTML(heading);
    if (currentOverlayRef.current) {
      currentOverlayRef.current.setPosition(latlng);
      currentOverlayRef.current.setContent(html);
    } else {
      const overlay = new kakao.maps.CustomOverlay({
        position: latlng,
        content: html,
        yAnchor: 0.5,
        map: mapInstanceRef.current,
      });
      currentOverlayRef.current = overlay;
    }
    if (followUser) {
      mapInstanceRef.current.panTo(latlng);
    }
  }, [currentPosition, heading, followUser]);

  // 미리보기 파선 (경로 데이터 없을 때만 표시)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (previewLineRef.current) {
      previewLineRef.current.setMap(null);
      previewLineRef.current = null;
    }
    if (!previewLine || !startPoint || !endPoint || routePath.length > 0) return;
    const line = new kakao.maps.Polyline({
      path: [
        new kakao.maps.LatLng(startPoint.lat, startPoint.lng),
        new kakao.maps.LatLng(endPoint.lat, endPoint.lng),
      ],
      strokeWeight: 3,
      strokeColor: "#8e8e93",
      strokeOpacity: 0.8,
      strokeStyle: "dashed",
      map: mapInstanceRef.current,
    });
    previewLineRef.current = line;
  }, [previewLine, startPoint, endPoint, routePath]);

  // 경로 안내 폴리라인 (OSRM 도보 경로)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (routeLineRef.current) {
      routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }
    if (routePath.length < 2) return;
    const routeLine = new kakao.maps.Polyline({
      path: routePath.map((p) => new kakao.maps.LatLng(p.lat, p.lng)),
      strokeWeight: 6,
      strokeColor: "#007aff",
      strokeOpacity: 0.85,
      strokeStyle: "solid",
      map: mapInstanceRef.current,
    });
    routeLineRef.current = routeLine;
  }, [routePath]);

  // 검색 미리보기 핀 마커
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (previewMarkerRef.current) {
      previewMarkerRef.current.setMap(null);
      previewMarkerRef.current = null;
    }
    if (!previewPoint) return;
    const latlng = new kakao.maps.LatLng(previewPoint.lat, previewPoint.lng);
    const img = new kakao.maps.MarkerImage(
      PREVIEW_MARKER_SRC,
      new kakao.maps.Size(44, 54),
      { offset: new kakao.maps.Point(22, 52) }
    );
    previewMarkerRef.current = new kakao.maps.Marker({
      position: latlng,
      image: img,
      map: mapInstanceRef.current,
    });
  }, [previewPoint]);

  // activityType 변경 시 기존 폴리라인 색상 업데이트 + 이동 경로 폴리라인
  useEffect(() => {
    if (!mapInstanceRef.current || pathPoints.length < 2) return;

    const path = pathPoints.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
    const color = activityType === "walking" ? "#34c759" : "#007aff";

    // 색상이 바뀌었거나 폴리라인이 없으면 재생성
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    polylineRef.current = new kakao.maps.Polyline({
      path,
      strokeWeight: 5,
      strokeColor: color,
      strokeOpacity: 0.92,
      strokeStyle: "solid",
      map: mapInstanceRef.current,
    });
  }, [pathPoints, activityType]);

  return <div ref={mapRef} className={`w-full ${className}`} />;
});

export default KakaoMap;
