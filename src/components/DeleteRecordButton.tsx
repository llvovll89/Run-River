"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRunningRecord } from "@/lib/supabase";

export default function DeleteRecordButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    try {
      await deleteRunningRecord(id);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
      setConfirm(false);
    }
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        {error && (
          <span className="text-xs" style={{ color: "var(--c-danger)" }}>{error}</span>
        )}
        <button
          onClick={() => setConfirm(false)}
          disabled={isPending}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-xl active:scale-95 transition-transform"
          style={{
            background: "var(--c-elevated)",
            border: "1px solid var(--c-border)",
            color: "var(--c-text-2)",
          }}
        >
          취소
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-xl active:scale-95 transition-transform"
          style={{
            background: isPending ? "var(--c-elevated)" : "var(--c-danger)",
            color: isPending ? "var(--c-text-3)" : "#fff",
          }}
        >
          {isPending ? "삭제 중…" : "삭제 확인"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="w-8 h-8 flex items-center justify-center rounded-xl active:scale-95 transition-transform"
      style={{
        background: "var(--c-elevated)",
        border: "1px solid var(--c-border)",
        color: "var(--c-text-3)",
      }}
      aria-label="기록 삭제"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      </svg>
    </button>
  );
}
