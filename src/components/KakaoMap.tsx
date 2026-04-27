"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import type { LatLng, ActivityType } from "@/types";

const _startSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="62"><defs><filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/></filter></defs><g filter="url(#sh)"><circle cx="26" cy="24" r="20" fill="#30d158" stroke="white" stroke-width="3"/><text x="26" y="29" text-anchor="middle" fill="white" font-size="11" font-weight="900" font-family="-apple-system,sans-serif">출발</text><polygon points="19,42 26,54 33,42" fill="#30d158"/></g></svg>';
const START_MARKER_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(_startSvg)}`;

const _endSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="62"><defs><filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/></filter></defs><g filter="url(#sh)"><circle cx="26" cy="24" r="20" fill="#ff9f0a" stroke="white" stroke-width="3"/><text x="26" y="29" text-anchor="middle" fill="white" font-size="11" font-weight="900" font-family="-apple-system,sans-serif">도착</text><polygon points="19,42 26,54 33,42" fill="#ff9f0a"/></g></svg>';
const END_MARKER_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(_endSvg)}`;

const CURRENT_MARKER_HTML = `
  <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:22px;height:22px;border-radius:50%;background:rgba(0,122,255,0.18)"></div>
    <div style="position:absolute;width:15px;height:15px;border-radius:50%;background:rgba(0,122,255,0.25)"></div>
    <div style="width:10px;height:10px;border-radius:50%;background:#007aff;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,122,255,0.6)"></div>
  </div>`;

const _previewSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50"><defs><filter id="psh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.35"/></filter></defs><g filter="url(#psh)" opacity="0.92"><circle cx="20" cy="18" r="15" fill="#636366" stroke="white" stroke-width="3"/><circle cx="20" cy="18" r="5" fill="white" opacity="0.9"/><polygon points="14,31 20,46 26,31" fill="#636366"/></g></svg>';
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
  pathPoints?: LatLng[];
  routePath?: LatLng[];
  showArrivalRadius?: boolean;
  previewLine?: boolean;
  previewPoint?: LatLng | null;
  activityType?: ActivityType;
  followUser?: boolean;
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
  pathPoints = [],
  routePath = [],
  showArrivalRadius = false,
  previewLine = false,
  previewPoint = null,
  activityType = "running",
  followUser = false,
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
        center: latlng, radius: 50,
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
    if (followUser) {
      mapInstanceRef.current.panTo(latlng);
    }
  }, [currentPosition, followUser]);

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
      new kakao.maps.Size(40, 50),
      { offset: new kakao.maps.Point(20, 48) }
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
