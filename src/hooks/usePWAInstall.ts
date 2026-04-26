"use client";

import { useEffect, useState } from "react";

type Browser = "chrome-android" | "ios-safari" | "unsupported";

interface PWAInstallState {
  browser: Browser;
  canInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;
}

function detectBrowser(): Browser {
  if (typeof navigator === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  if (isIOS) return "ios-safari";
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge|OPR/.test(ua);
  if (isAndroid && isChrome) return "chrome-android";
  return "unsupported";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [installed, setInstalled] = useState(false);
  const [browser, setBrowser] = useState<Browser>("unsupported");

  useEffect(() => {
    setBrowser(detectBrowser());
    setInstalled(isStandalone());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> });
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const canInstall =
    !installed &&
    (browser === "ios-safari" || (browser === "chrome-android" && !!deferredPrompt));

  async function promptInstall() {
    if (browser === "chrome-android" && deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    }
  }

  return { browser, canInstall, isInstalled: installed, promptInstall };
}
