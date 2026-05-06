"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useOfflineSync } from "@/hooks/useOfflineSync";

function formatRelativeTime(ts: number | null): string {
  if (!ts) return "아직 없음";
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}초 전`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  return `${diffHour}시간 전`;
}

function formatRetryTime(ts: number | null): string {
  if (!ts) return "-";
  const diffSec = Math.max(0, Math.round((ts - Date.now()) / 1000));
  if (diffSec <= 0) return "지금";
  if (diffSec < 60) return `${diffSec}초 후`;
  return `${Math.round(diffSec / 60)}분 후`;
}

export default function OfflineSyncBanner() {
  const pathname = usePathname();
  const {
    pendingCount,
    blockedCount,
    exhaustedCount,
    syncing,
    lastSyncedAt,
    lastError,
    nextRetryAt,
    syncNow,
  } = useOfflineSync();

  const shouldShow = pendingCount > 0 || !!lastError;

  // 러닝 화면에서는 하단 컨트롤 터치 우선
  if (pathname === "/running") return null;

  const statusText = useMemo(() => {
    if (syncing) return "동기화 중...";
    if (pendingCount === 0 && lastError) return "동기화 오류";
    if (pendingCount === 0) return "동기화 완료";
    if (exhaustedCount > 0) {
      return `대기 ${pendingCount}건 · 수동 확인 ${exhaustedCount}건`;
    }
    if (blockedCount > 0) {
      return `대기 ${pendingCount}건 · 재시도 ${formatRetryTime(nextRetryAt)}`;
    }
    return `대기 ${pendingCount}건`;
  }, [syncing, pendingCount, blockedCount, exhaustedCount, nextRetryAt, lastError]);

  if (!shouldShow) return null;

  return (
    <div
      className="absolute left-3 right-3 z-40 rounded-2xl px-3 py-2.5"
      style={{
        bottom: "calc(var(--sab) + 10px)",
        background: "rgba(18,19,21,0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        pointerEvents: "none",
      }}
    >
      <div className="flex items-center justify-between gap-2" style={{ pointerEvents: "auto" }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>오프라인 동기화</p>
          <p style={{ fontSize: 11, color: "#9da1a6", marginTop: 1 }}>
            {statusText} · 마지막 성공 {formatRelativeTime(lastSyncedAt)}
          </p>
          {lastError && (
            <p style={{ fontSize: 11, color: "#ff9f0a", marginTop: 1 }}>
              최근 오류: {lastError}
            </p>
          )}
        </div>
        <button
          onClick={() => void syncNow()}
          disabled={syncing || pendingCount === 0}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
          style={{
            background: syncing || pendingCount === 0 ? "rgba(255,255,255,0.12)" : "var(--c-toss-blue)",
            color: syncing || pendingCount === 0 ? "#9da1a6" : "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {syncing ? "동기화 중" : "지금 동기화"}
        </button>
      </div>
    </div>
  );
}
