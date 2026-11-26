"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
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

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const shouldShow = pendingCount > 0 || !!lastError;

  // 러닝 화면에서는 하단 컨트롤 터치 우선
  const statusText = useMemo(() => {
    if (syncing) return "기록을 올리는 중…";
    if (pendingCount === 0 && lastError) return "기록을 올리지 못했어요";
    if (pendingCount === 0) return "모든 기록을 올렸어요";
    if (exhaustedCount > 0) {
      return `올릴 기록 ${pendingCount}건, 다시 시도가 필요한 기록 ${exhaustedCount}건`;
    }
    if (blockedCount > 0) {
      return `올릴 기록 ${pendingCount}건, ${formatRetryTime(nextRetryAt)} 다시 시도`;
    }
    return `올릴 기록 ${pendingCount}건`;
  }, [syncing, pendingCount, blockedCount, exhaustedCount, nextRetryAt, lastError]);

  // 모든 훅을 부른 뒤에 숨긴다(경로마다 훅 개수가 달라지면 레이아웃이 깨진다).
  // 러닝 화면은 하단 조작을, 홈은 시작 버튼을 가리지 않도록 표시하지 않는다.
  if (!shouldShow || pathname === "/running" || pathname === "/") return null;

  return (
    <div
      className="fixed z-40 rounded-2xl px-3 py-2.5"
      style={{
        // 하단 탐색(약 58px) 바로 위
        bottom: "calc(var(--sab) + 66px)",
        left: "max(12px, calc(50% - 203px))",
        right: "max(12px, calc(50% - 203px))",
        background: "var(--c-surface)",
        border: "1px solid var(--c-border)",
        boxShadow: "0 8px 24px rgba(12,18,30,0.14)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>{statusText}</p>
          <p style={{ fontSize: 13, color: !isOnline || lastError ? "var(--c-warn)" : "var(--c-text-2)", marginTop: 1 }}>
            {!isOnline ? "인터넷에 연결되면 올라가요" : lastError ? `최근 오류: ${lastError}` : `마지막 업로드 ${formatRelativeTime(lastSyncedAt)}`}
          </p>
        </div>
        <button
          type="button"
          // 사용자가 직접 누르면 재시도 대기 중인 기록도 바로 올린다.
          onClick={() => void syncNow(true)}
          disabled={syncing || pendingCount === 0 || !isOnline}
          className="btn shrink-0"
          data-tone="accent"
          style={{ minHeight: 44, fontSize: 14, padding: "0 14px" }}
        >
          {syncing ? "올리는 중" : exhaustedCount > 0 ? "다시 시도" : "지금 올리기"}
        </button>
      </div>
    </div>
  );
}
