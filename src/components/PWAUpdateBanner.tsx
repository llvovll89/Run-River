"use client";

import { usePWAUpdate } from "@/hooks/usePWAUpdate";

export default function PWAUpdateBanner() {
  const { updateAvailable, applyUpdate, dismissUpdate } = usePWAUpdate();

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        top: "calc(var(--sat, 0px) + 12px)",
        maxWidth: "calc(430px - 32px)",
        width: "calc(100vw - 32px)",
        background: "var(--c-elevated, #1c1c1e)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* 아이콘 */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(0,122,255,0.18)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight" style={{ color: "var(--c-text-1, #fff)" }}>
          새 업데이트 available
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--c-text-3, rgba(255,255,255,0.45))" }}>
          지금 적용하거나 나중에 업데이트할 수 있어요
        </p>
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={dismissUpdate}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "var(--c-text-2, rgba(255,255,255,0.6))",
          }}
        >
          나중에
        </button>
        <button
          onClick={applyUpdate}
          className="px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform"
          style={{
            background: "#007aff",
            color: "#fff",
            boxShadow: "0 2px 10px rgba(0,122,255,0.45)",
          }}
        >
          업데이트
        </button>
      </div>
    </div>
  );
}
