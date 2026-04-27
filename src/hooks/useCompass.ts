"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseCompassReturn {
  heading: number | null;
  isSupported: boolean;
  needsPermission: boolean;
  requestPermission: () => Promise<void>;
}

type DOEWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export function useCompass(): UseCompassReturn {
  const [heading, setHeading] = useState<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const listeningRef = useRef(false);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const e = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
    if (typeof e.webkitCompassHeading === "number") {
      setHeading(Math.round(e.webkitCompassHeading));
    } else if (event.absolute && event.alpha !== null) {
      setHeading(Math.round((360 - event.alpha) % 360));
    }
  }, []);

  const startListening = useCallback(() => {
    if (listeningRef.current) return;
    listeningRef.current = true;
    window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
    window.addEventListener("deviceorientation", handleOrientation as EventListener, true);
  }, [handleOrientation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "DeviceOrientationEvent" in window;
    setIsSupported(supported);
    if (!supported) return;

    const DOE = DeviceOrientationEvent as DOEWithPermission;
    if (typeof DOE.requestPermission === "function") {
      // iOS 13+ – permission required before listening
      setNeedsPermission(true);
    } else {
      // Android / non-iOS – start immediately
      startListening();
    }

    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
      window.removeEventListener("deviceorientation", handleOrientation as EventListener, true);
      listeningRef.current = false;
    };
  }, [handleOrientation, startListening]);

  const requestPermission = useCallback(async () => {
    const DOE = DeviceOrientationEvent as DOEWithPermission;
    if (typeof DOE.requestPermission === "function") {
      const result = await DOE.requestPermission();
      if (result !== "granted") return;
    }
    setNeedsPermission(false);
    startListening();
  }, [startListening]);

  return { heading, isSupported, needsPermission, requestPermission };
}
