"use client";

import { useState, useCallback } from "react";
import { updateRunningMemo } from "@/lib/supabase";

const MEMO_MAX = 300;

export default function EditableMemo({ id, initialMemo }: { id: string; initialMemo: string }) {
  const [memo, setMemo] = useState(initialMemo);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialMemo);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const startEdit = useCallback(() => {
    setDraft(memo);
    setStatus("idle");
    setEditing(true);
  }, [memo]);

  const cancel = useCallback(() => {
    setEditing(false);
    setStatus("idle");
  }, []);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setStatus("idle");
    try {
      const normalized = draft.trim();
      const saved = await updateRunningMemo(id, normalized.length > 0 ? normalized : null);
      setMemo(saved.memo ?? "");
      setEditing(false);
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }, [id, draft, saving]);

  if (editing) {
    return (
      <div className="px-4 pb-3.5" style={{ borderTop: "1px solid var(--c-border)" }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MEMO_MAX))}
          className="w-full rounded-xl p-3 text-sm resize-none mt-2"
          rows={3}
          style={{
            background: "var(--c-elevated)",
            border: "1px solid var(--c-border)",
            color: "var(--c-text-1)",
          }}
          autoFocus
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className="num" style={{ fontSize: 11, color: "var(--c-text-3)" }}>
            {draft.length}/{MEMO_MAX}
            {status === "error" && (
              <span style={{ color: "var(--c-danger)", marginLeft: 6 }}>저장 실패</span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              onClick={cancel}
              disabled={saving}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-[0.98] transition-transform"
              style={{
                background: "var(--c-elevated)",
                border: "1px solid var(--c-border)",
                color: "var(--c-text-2)",
              }}
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-[0.98] transition-transform"
              style={{
                background: "var(--c-toss-blue)",
                color: "white",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasMemo = memo.trim().length > 0;

  return (
    <div className="px-4 pb-3.5" style={{ borderTop: "1px solid var(--c-border)" }}>
      {hasMemo ? (
        <>
          <p
            className="pt-2"
            style={{
              fontSize: 13,
              color: "var(--c-text-2)",
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}
          >
            {memo.trim()}
          </p>
          {status === "success" && (
            <p style={{ fontSize: 11, color: "var(--c-walk)", marginTop: 4 }}>저장되었습니다.</p>
          )}
          <button
            onClick={startEdit}
            className="mt-2 active:scale-[0.98] transition-transform"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)" }}
          >
            메모 수정
          </button>
        </>
      ) : (
        <div className="pt-2 flex items-center justify-between">
          {status === "success" && (
            <p style={{ fontSize: 11, color: "var(--c-walk)" }}>저장되었습니다.</p>
          )}
          <button
            onClick={startEdit}
            className="active:scale-[0.98] transition-transform"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)" }}
          >
            + 메모 추가
          </button>
        </div>
      )}
    </div>
  );
}
