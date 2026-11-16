"use client";

import { usePWAUpdate } from "@/hooks/usePWAUpdate";

/** Updates apply on their own (see usePWAUpdate); this only confirms it briefly afterwards. */
export default function PWAUpdateBanner() {
  const { justUpdated } = usePWAUpdate();
  if (!justUpdated) return null;
  return (
    <p className="pwa-updated-toast" role="status">
      새 버전으로 업데이트했어요
    </p>
  );
}
