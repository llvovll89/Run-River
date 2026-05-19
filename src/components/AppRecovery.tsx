"use client";

import { useEffect } from "react";

const RECOVERY_FLAG = "rr_recovery_once";

function shouldRecoverFromMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("chunkloaderror") ||
    normalized.includes("loading chunk") ||
    normalized.includes("loading css chunk") ||
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("dynamically imported module") ||
    normalized.includes("importing a module script failed")
  );
}

async function recoverOnce(reason: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(RECOVERY_FLAG) === "1") return;

  sessionStorage.setItem(RECOVERY_FLAG, "1");

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.update()));
    }
  } catch {
    // 캐시 정리 실패 시에도 재진입은 시도한다.
  }

  const url = new URL(window.location.href);
  url.searchParams.set("recover", Date.now().toString());
  url.searchParams.set("reason", reason);
  window.location.replace(url.toString());
}

export default function AppRecovery() {
  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const message = event.message || event.error?.message || "";
      if (!shouldRecoverFromMessage(message)) return;
      void recoverOnce("window-error");
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason?.message || reason?.toString?.() || "";

      if (!shouldRecoverFromMessage(message)) return;
      void recoverOnce("unhandled-rejection");
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    // 정상 부팅이 완료되면 다음 장애 대비를 위해 플래그를 해제한다.
    const clearFlag = window.setTimeout(() => {
      sessionStorage.removeItem(RECOVERY_FLAG);
    }, 4000);

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.clearTimeout(clearFlag);
    };
  }, []);

  return null;
}
