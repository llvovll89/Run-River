"use client";

import { useEffect, useState } from "react";
import { readActiveRun } from "@/lib/runStorage";

const UPDATED_FLAG = "rr_pwa_updated";

/** Never swap versions under a live recording: the running screen or a recoverable run. */
function isSafeToUpdate(): boolean {
  if (/^\/running\/?$/.test(window.location.pathname)) return false;
  try { return !readActiveRun(); } catch { return false; }
}

function reload() {
  try { sessionStorage.setItem(UPDATED_FLAG, "1"); } catch { /* toast only */ }
  window.location.reload();
}

/**
 * Applies new app versions automatically instead of asking the user.
 * - Found on launch: activate and reload right away (the screen has barely rendered).
 * - Found while in use: activate silently and reload the next time the app is hidden,
 *   so the user returns to the new version without a mid-task refresh.
 * - During a run: wait; the check repeats whenever the app comes back to the foreground.
 */
export function usePWAUpdate() {
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_NATIVE_APP === "1") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    try {
      if (sessionStorage.getItem(UPDATED_FLAG)) {
        sessionStorage.removeItem(UPDATED_FLAG);
        setJustUpdated(true);
      }
    } catch { /* ignore */ }

    let disposed = false;
    let reloadWhenHidden = false;
    let registration: ServiceWorkerRegistration | null = null;
    const launchedAt = Date.now();

    const activate = (worker: ServiceWorker | null) => {
      // Without a controller this is the first install, not an update.
      if (!worker || !navigator.serviceWorker.controller || disposed || !isSafeToUpdate()) return;
      worker.postMessage({ type: "SKIP_WAITING" });
    };

    const onControllerChange = () => {
      if (disposed) return;
      // Right after launch nobody is mid-task yet; otherwise wait until the app is in the background.
      if (Date.now() - launchedAt < 5000 && document.visibilityState === "visible") reload();
      else reloadWhenHidden = true;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (reloadWhenHidden && isSafeToUpdate()) reload();
        return;
      }
      // PWAs stay open for days; look for a new version each time the app returns.
      void registration?.update().catch(() => undefined);
      activate(registration?.waiting ?? null);
    };

    navigator.serviceWorker.ready.then((ready) => {
      if (disposed) return;
      registration = ready;
      activate(ready.waiting);
      ready.addEventListener("updatefound", () => {
        const worker = ready.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") activate(worker);
        });
      });
    });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!justUpdated) return;
    const timer = window.setTimeout(() => setJustUpdated(false), 3000);
    return () => window.clearTimeout(timer);
  }, [justUpdated]);

  return { justUpdated };
}
