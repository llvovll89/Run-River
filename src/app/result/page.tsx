"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { saveRunningRecord, deleteRunningRecord, updateRunningMemo } from "@/lib/supabase";
import { formatDuration, formatPace, formatDateFull } from "@/lib/utils";
import type { LatLng, ActivityType } from "@/types";

const KakaoMap = dynamic(() => import("@/components/KakaoMap"), { ssr: false });

interface RunResult {
  startPoint: LatLng;
  endPoint: LatLng;
  distance_km: number;
  duration_seconds: number;
  pace: number;
  activity_type: ActivityType;
  pathPoints?: LatLng[];
}

export default function ResultPage() {
  const MEMO_MAX_LENGTH = 300;
  const router = useRouter();
  const [result, setResult] = useState<RunResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [memo, setMemo] = useState("");
  const [lastSavedMemo, setLastSavedMemo] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [memoStatus, setMemoStatus] = useState<"idle" | "success" | "error">("idle");

  const doSave = useCallback((parsed: RunResult) => {
    setSaving(true);
    setSaveError(false);
    saveRunningRecord({
      start_point: parsed.startPoint,
      end_point:   parsed.endPoint,
      distance_km: parsed.distance_km,
      duration_seconds: parsed.duration_seconds,
      pace:          parsed.pace,
      activity_type: parsed.activity_type,
    })
      .then((record) => {
        setSavedId(record.id);
        sessionStorage.removeItem("runResult");
        sessionStorage.removeItem("runConfig");
      })
      .catch(() => setSaveError(true))
      .finally(() => setSaving(false));
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("runResult");
    if (!raw) { router.replace("/"); return; }
    const parsed: RunResult = JSON.parse(raw);
    setResult(parsed);
    doSave(parsed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDiscard = useCallback(async () => {
    if (!savedId || discarding) return;
    setDiscarding(true);
    try {
      await deleteRunningRecord(savedId);
    } catch {
      // 삭제 실패해도 메인으로 이동
    } finally {
      setDiscarding(false);
      router.replace("/");
    }
  }, [savedId, discarding, router]);

  const handleSaveMemo = useCallback(async () => {
    if (!savedId || memoSaving) return;
    setMemoSaving(true);
    setMemoStatus("idle");
    try {
      const normalized = memo.trim();
      const saved = await updateRunningMemo(savedId, normalized.length > 0 ? normalized : null);
      const persistedMemo = saved.memo ?? "";
      setMemo(persistedMemo);
      setLastSavedMemo(persistedMemo);
      setMemoStatus("success");
    } catch {
      setMemoStatus("error");
    } finally {
      setMemoSaving(false);
    }
  }, [savedId, memoSaving, memo]);

  if (!result) return null;

  const isRun  = result.activity_type === "running";
  const accent = isRun ? "var(--c-toss-blue)" : "var(--c-walk)";
  const label  = isRun ? "러닝" : "워킹";

  const dateStr = formatDateFull(new Date());

  const calories = Math.round(result.distance_km * (isRun ? 65 : 45));
  const steps    = Math.round(result.distance_km * (isRun ? 1300 : 1400));

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: "var(--c-bg)" }}>
      {/* 헤더 */}
      <div
        className="px-5"
        style={{
          paddingTop: "calc(var(--sat) + 10px)",
          paddingBottom: "28px",
          background: "var(--c-surface)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}
            aria-label="홈으로 가기"
          >
            <svg width="16" height="16" style={{ color: "var(--c-text-1)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full inline-block"
              style={{ background: `${accent}18`, color: accent, letterSpacing: "-0.01em" }}
            >
              {label} 완료
            </span>
            {saving ? (
              <span className="text-xs" style={{ color: "var(--c-text-3)" }}>저장 중…</span>
            ) : savedId ? (
              <span className="text-xs font-semibold" style={{ color: "var(--c-walk)" }}>✓ 자동 저장됨</span>
            ) : saveError ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--c-danger)" }}>저장 실패</span>
                <button
                  onClick={() => result && doSave(result)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                  style={{ background: "rgba(255,69,58,0.12)", color: "var(--c-danger)", border: "1px solid rgba(255,69,58,0.3)" }}
                >
                  재시도
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: "var(--c-text-1)",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          {result.distance_km.toFixed(2)}
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--c-text-2)", marginLeft: 6 }}>km</span>
        </h1>
        <p className="mt-1" style={{ fontSize: 14, color: "var(--c-text-3)" }}>{dateStr}</p>
      </div>

      {/* 경로 지도 */}
      {result.pathPoints && result.pathPoints.length > 1 && (
        <div className="px-4 pt-3">
          <div className="card rounded-2xl overflow-hidden" style={{ height: 200 }}>
            <KakaoMap
              center={result.startPoint}
              startPoint={result.startPoint}
              endPoint={result.endPoint}
              pathPoints={result.pathPoints}
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* 핵심 스탯 */}
      <div className="px-4 pt-3 slide-up">
        <div className="card rounded-2xl">
          <div className="grid grid-cols-3">
            {[
              { label: "소요 시간",   value: formatDuration(result.duration_seconds), unit: "" },
              { label: "평균 페이스", value: formatPace(result.pace),                  unit: "/km" },
              { label: "거리",        value: result.distance_km.toFixed(2),            unit: "km" },
            ].map(({ label: l, value, unit }, i) => (
              <div
                key={l}
                className="py-4 text-center"
                style={{ borderRight: i < 2 ? "1px solid var(--c-border)" : "none" }}
              >
                <p style={{ fontSize: 11, color: "var(--c-text-3)", marginBottom: 4 }}>{l}</p>
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="num" style={{ fontSize: 18, fontWeight: 800, color: accent, letterSpacing: "-0.03em" }}>{value}</span>
                  {unit && <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 부가 정보 */}
      <div className="px-4 mt-3">
        <div className="card rounded-2xl">
          <p
            className="px-4 pt-4 pb-2"
            style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}
          >
            활동 요약
          </p>
          {[
            { label: "활동 유형",    value: label },
            { label: "예상 칼로리", value: `${calories.toLocaleString()} kcal` },
            { label: "예상 걸음 수", value: `${steps.toLocaleString()} 보` },
          ].map(({ label: l, value }, i, arr) => (
            <div
              key={l}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: i === 0 ? "1px solid var(--c-border)" : "none", borderBottom: i < arr.length - 1 ? "1px solid var(--c-border)" : "none" }}
            >
              <span style={{ fontSize: 14, color: "var(--c-text-2)" }}>{l}</span>
              <span className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>{value}</span>
            </div>
          ))}
          <p
            className="px-4 pb-3 pt-1"
            style={{ fontSize: 11, color: "var(--c-text-3)" }}
          >
            * 칼로리는 체중 70kg 기준 추정치입니다
          </p>
        </div>
      </div>

      {/* 메모 */}
      <div className="px-4 mt-3">
        <div className="card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--c-text-3)",
              }}
            >
              러닝 메모
            </p>
            <span className="num" style={{ fontSize: 11, color: "var(--c-text-3)" }}>
              {memo.length}/{MEMO_MAX_LENGTH}
            </span>
          </div>
          <textarea
            value={memo}
            onChange={(e) => {
              setMemo(e.target.value.slice(0, MEMO_MAX_LENGTH));
              if (memoStatus !== "idle") setMemoStatus("idle");
            }}
            placeholder="오늘 어떤 생각으로 달렸는지 남겨보세요."
            className="w-full rounded-2xl p-3 text-sm resize-none"
            rows={4}
            style={{
              background: "var(--c-elevated)",
              border: "1px solid var(--c-border)",
              color: "var(--c-text-1)",
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>
              {memoStatus === "success"
                ? "메모가 저장되었습니다."
                : memoStatus === "error"
                  ? "저장에 실패했습니다. 다시 시도해주세요."
                  : ""}
            </span>
            <button
              onClick={handleSaveMemo}
              disabled={!savedId || saving || memoSaving || memo === lastSavedMemo}
              className="px-4 py-2 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
              style={{
                background: "var(--c-toss-blue)",
                color: "white",
                opacity: !savedId || saving || memoSaving || memo === lastSavedMemo ? 0.5 : 1,
              }}
            >
              {memoSaving ? "메모 저장 중…" : "메모 저장"}
            </button>
          </div>
        </div>
      </div>

      {/* 액션 */}
      <div
        className="px-4 mt-auto pt-4 space-y-2"
        style={{ paddingBottom: "calc(var(--sab) + 20px)" }}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push("/history")}
            className="py-4 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
            style={{
              background: "var(--c-elevated)",
              border: "1px solid var(--c-border)",
              color: "var(--c-text-2)",
              letterSpacing: "-0.01em",
            }}
          >
            기록 보기
          </button>
          <button
            onClick={() => router.push("/")}
            className="py-4 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
            style={{
              background: "var(--c-elevated)",
              border: "1px solid var(--c-border)",
              color: "var(--c-text-2)",
              letterSpacing: "-0.01em",
            }}
          >
            다시 시작
          </button>
        </div>
        <button
          onClick={handleDiscard}
          disabled={saving || discarding || !savedId}
          className="w-full py-3 rounded-2xl text-sm font-medium active:scale-[0.98] transition-transform"
          style={{
            background: "transparent",
            color: saving || !savedId ? "var(--c-text-3)" : "var(--c-danger)",
            border: "1px solid",
            borderColor: saving || !savedId ? "var(--c-border)" : "rgba(255,69,58,0.3)",
            letterSpacing: "-0.01em",
          }}
        >
          {discarding ? "삭제 중…" : saving ? "저장 중…" : "저장 안 함"}
        </button>
      </div>
    </main>
  );
}

