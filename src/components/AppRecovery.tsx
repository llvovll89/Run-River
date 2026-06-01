"use client";

import { useEffect } from "react";

const RECOVERY_FLAG = "rr_recovery_once";
const RECOVERY_ATTEMPTS_KEY = "rr_recovery_attempts";
const MAX_RECOVERY_ATTEMPTS = 3;

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

  const attempts = Number.parseInt(
    sessionStorage.getItem(RECOVERY_ATTEMPTS_KEY) || "0",
    10,
  );
  if (attempts >= MAX_RECOVERY_ATTEMPTS) return;

  sessionStorage.setItem(RECOVERY_ATTEMPTS_KEY, String(attempts + 1));
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
    const bootUrl = new URL(window.location.href);
    const fromRecovery = bootUrl.searchParams.has("recover");

    if (!fromRecovery) {
      sessionStorage.removeItem(RECOVERY_FLAG);
      sessionStorage.removeItem(RECOVERY_ATTEMPTS_KEY);
    }

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

    // 정상 부팅이 일정 시간 유지되면 다음 장애 대비를 위해 상태를 초기화한다.
    const clearFlag = window.setTimeout(() => {
      sessionStorage.removeItem(RECOVERY_FLAG);
      sessionStorage.removeItem(RECOVERY_ATTEMPTS_KEY);
    }, 10000);

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.clearTimeout(clearFlag);
    };
  }, []);

  return null;
}
