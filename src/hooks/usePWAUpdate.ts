"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export function usePWAUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });
    });

    // skipWaiting 후 새 SW가 controllerchange 이벤트를 발생시키면 안전하게 한 번만 리로드
    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.setTimeout(() => {
        window.location.reload();
      }, 300);
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    setIsApplying(true);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });

    // 일부 환경에서 controllerchange가 누락될 수 있어 폴백 리로드를 둔다.
    window.setTimeout(() => {
      if (!refreshingRef.current) {
        refreshingRef.current = true;
        window.location.reload();
      }
    }, 3500);
  }, [waitingWorker]);

  const dismissUpdate = useCallback(() => {
    setWaitingWorker(null);
  }, []);

  return {
    updateAvailable: !!waitingWorker,
    isApplying,
    applyUpdate,
    dismissUpdate,
  };
}
