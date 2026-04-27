"use client";

import { useEffect, useState, useCallback } from "react";

export function usePWAUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

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

    // skipWaiting 후 새 SW가 controllerchange 이벤트를 발생시키면 리로드
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }, [waitingWorker]);

  const dismissUpdate = useCallback(() => {
    setWaitingWorker(null);
  }, []);

  return {
    updateAvailable: !!waitingWorker,
    applyUpdate,
    dismissUpdate,
  };
}
