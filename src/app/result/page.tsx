"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveRunningRecord } from "@/lib/supabase";
import { formatDuration, formatPace } from "@/lib/utils";
import type { LatLng, ActivityType } from "@/types";

interface RunResult {
  startPoint: LatLng;
  endPoint: LatLng;
  distance_km: number;
  duration_seconds: number;
  pace: number;
  activity_type: ActivityType;
}

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<RunResult | null>(null);
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("runResult");
    if (!raw) { router.replace("/"); return; }
    setResult(JSON.parse(raw));
  }, [router]);

  async function handleSave() {
    if (!result || saved) return;
    setSaving(true);
    try {
      await saveRunningRecord({
        start_point: result.startPoint,
        end_point:   result.endPoint,
        distance_km: result.distance_km,
        duration_seconds: result.duration_seconds,
        pace:          result.pace,
        activity_type: result.activity_type,
      });
      setSaved(true);
      sessionStorage.removeItem("runResult");
      sessionStorage.removeItem("runConfig");
    } catch {
      alert("저장 실패. Supabase 설정을 확인하세요.");
    } finally {
      setSaving(false);
    }
  }

  if (!result) return null;

  const isRun  = result.activity_type === "running";
  const accent = isRun ? "var(--c-toss-blue)" : "var(--c-walk)";
  const label  = isRun ? "러닝" : "워킹";

  const dateStr = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  const calories = Math.round(result.distance_km * (isRun ? 65 : 45));
  const steps    = Math.round(result.distance_km * (isRun ? 1300 : 1400));

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: "var(--c-bg)" }}>
      {/* 헤더 */}
      <div
        className="px-5"
        style={{
          paddingTop: "calc(var(--sat) + 52px)",
          paddingBottom: "28px",
          background: "var(--c-surface)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full inline-block mb-4"
          style={{ background: `${accent}18`, color: accent, letterSpacing: "-0.01em" }}
        >
          {label} 완료
        </span>
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
          <div style={{ paddingBottom: 4 }} />
        </div>
      </div>

      {/* 액션 */}
      <div
        className="px-4 mt-auto pt-4 space-y-2"
        style={{ paddingBottom: "calc(var(--sab) + 20px)" }}
      >
        {!saved ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98]"
            style={{
              background: saving ? "var(--c-elevated)" : accent,
              color: saving ? "var(--c-text-2)" : "#fff",
              border: saving ? "1px solid var(--c-border)" : "none",
              boxShadow: saving ? "none" : `0 4px 20px ${accent}44`,
              letterSpacing: "-0.01em",
            }}
          >
            {saving ? "저장 중..." : "기록 저장"}
          </button>
        ) : (
          <div
            className="w-full py-4 rounded-2xl text-center font-bold text-base flex items-center justify-center gap-2"
            style={{ background: "rgba(48,209,88,0.12)", color: "var(--c-walk)", border: "1px solid rgba(48,209,88,0.25)" }}
          >
            <CheckIcon />
            저장 완료
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "기록 보기", href: "/history" },
            { label: "다시 시작", href: "/" },
          ].map(({ label: l, href }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="py-4 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
              style={{
                background: "var(--c-elevated)",
                border: "1px solid var(--c-border)",
                color: "var(--c-text-2)",
                letterSpacing: "-0.01em",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
