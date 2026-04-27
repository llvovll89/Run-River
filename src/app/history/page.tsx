import { getRunningHistory } from "@/lib/supabase";
import { formatDuration, formatPace } from "@/lib/utils";
import Link from "next/link";
import type { RunningRecord } from "@/types";
import WeeklyChart from "@/components/WeeklyChart";
import DeleteRecordButton from "@/components/DeleteRecordButton";

export const revalidate = 0;

export default async function HistoryPage() {
  let records: RunningRecord[] = [];
  let fetchError = "";

  try {
    records = await getRunningHistory();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "기록을 불러올 수 없습니다.";
  }

  const totalDist = records.reduce((s, r) => s + r.distance_km, 0);
  const totalDays = new Set(records.map((r) => r.created_at.slice(0, 10))).size;
  const avgPace   = records.length > 0
    ? records.reduce((s, r) => s + r.pace, 0) / records.length : 0;

  return (
    <main className="min-h-dvh" style={{ background: "var(--c-bg)" }}>
      {/* 헤더 */}
      <div
        className="px-5"
        style={{
          paddingTop: "calc(var(--sat) + 10px)",
          paddingBottom: "16px",
          background: "var(--c-surface)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}
          >
            <svg width="16" height="16" style={{ color: "var(--c-text-1)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>

        <h1
          className="mb-0.5"
          style={{ fontSize: 34, fontWeight: 800, color: "var(--c-text-1)", letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          활동 기록
        </h1>
        <p style={{ fontSize: 15, color: "var(--c-text-2)" }}>총 {records.length}회</p>
      </div>

      {/* 요약 카드 */}
      {records.length > 0 && (
        <div className="px-4 pt-4">
          <div className="card rounded-2xl p-4">
            <p
              className="mb-3"
              style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}
            >
              전체 요약
            </p>
            <div className="grid grid-cols-3 gap-0">
              <SummaryNum value={totalDist.toFixed(1)} unit="km" label="총 거리" />
              <SummaryNum value={String(records.length)} unit="회" label="활동" />
              <SummaryNum value={String(totalDays)} unit="일" label="활동일" />
            </div>
            {avgPace > 0 && (
              <div
                className="flex justify-between items-center mt-3 pt-3"
                style={{ borderTop: "1px solid var(--c-border)" }}
              >
                <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>평균 페이스</span>
                <span className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>
                  {formatPace(avgPace)} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)" }}>/km</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 주간 차트 */}
      {records.length > 0 && <WeeklyChart records={records} />}

      {/* 리스트 */}
      <div className="px-4 pt-3 pb-8 space-y-2">
        {fetchError && (
          <div
            className="mt-4 rounded-2xl p-4 text-sm"
            style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", color: "var(--c-danger)" }}
          >
            {fetchError}
          </div>
        )}

        {!fetchError && records.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-20 gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
            >
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--c-text-3)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1" style={{ color: "var(--c-text-1)" }}>아직 기록이 없습니다</p>
              <p style={{ fontSize: 14, color: "var(--c-text-2)" }}>첫 활동을 시작해보세요</p>
            </div>
            <Link
              href="/"
              className="mt-2 px-6 py-3 rounded-2xl text-sm font-bold text-white"
              style={{ background: "var(--c-toss-blue)", boxShadow: "0 4px 16px var(--c-toss-blue)44" }}
            >
              활동 시작하기
            </Link>
          </div>
        )}

        {records.map((r, i) => <RecordCard key={r.id} record={r} rank={i + 1} />)}
      </div>
    </main>
  );
}

function SummaryNum({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-0.5">
        <span className="num" style={{ fontSize: 26, fontWeight: 800, color: "var(--c-text-1)", letterSpacing: "-0.03em" }}>{value}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)" }}>{unit}</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>{label}</p>
    </div>
  );
}

function RecordCard({ record, rank }: { record: RunningRecord; rank: number }) {
  const isRun  = record.activity_type === "running";
  const accent = isRun ? "var(--c-toss-blue)" : "var(--c-walk)";
  const date   = new Date(record.created_at);

  const dateStr = date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
  const timeStr = date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="card rounded-2xl transition-all active:scale-[0.99]">
      {/* 헤더 행 */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-3">
          <span
            className="num"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-3)", minWidth: 20 }}
          >
            {rank}
          </span>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text-1)", lineHeight: 1.2 }}>{dateStr}</p>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 1 }}>{timeStr}</p>
          </div>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${accent}18`, color: accent }}
        >
          {isRun ? "러닝" : "워킹"}
        </span>
        <DeleteRecordButton id={record.id} />
      </div>

      {/* 스탯 행 */}
      <div
        className="grid grid-cols-3 px-4 pb-3.5 pt-2"
        style={{ borderTop: "1px solid var(--c-border)" }}
      >
        {[
          { label: "거리",    value: record.distance_km.toFixed(2), unit: "km"  },
          { label: "시간",    value: formatDuration(record.duration_seconds), unit: "" },
          { label: "페이스",  value: formatPace(record.pace),        unit: "/km" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="text-center">
            <p style={{ fontSize: 11, color: "var(--c-text-3)", marginBottom: 2 }}>{label}</p>
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="num" style={{ fontSize: 17, fontWeight: 700, color: accent }}>{value}</span>
              {unit && <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
