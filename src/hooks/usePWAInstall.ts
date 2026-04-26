"use client";

import { useEffect, useState } from "react";

type InstallMode = "prompt" | "ios" | "unsupported";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

interface PWAInstallState {
  mode: InstallMode;
  canInstall: boolean;
  promptInstall: () => Promise<void>;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(null);
  const [mode, setMode] = useState<InstallMode>("unsupported");

  useEffect(() => {
    if (isStandalone()) return;

    if (isIOS()) {
      setMode("ios");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as DeferredPrompt);
      setMode("prompt");
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setMode("unsupported"));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const canInstall = mode === "ios" || (mode === "prompt" && !!deferredPrompt);

  async function promptInstall() {
    if (mode !== "prompt" || !deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setMode("unsupported");
    setDeferredPrompt(null);
  }

  return { mode, canInstall, promptInstall };
}
