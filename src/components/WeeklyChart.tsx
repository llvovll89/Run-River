"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import type { RunningRecord } from "@/types";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatDuration, formatPace, calcPace } from "@/lib/utils";

interface Props {
  records: RunningRecord[];
}

const PRESETS = [10, 20, 30, 50];

function getLast7Days(): { date: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toISOString().slice(0, 10),
      label: ["일", "월", "화", "수", "목", "금", "토"][d.getDay()],
    };
  });
}

function getCurrentMonthDays(): { date: string; label: string }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  return Array.from({ length: today }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return {
      date: d.toISOString().slice(0, 10),
      label: String(i + 1),
    };
  });
}

export default function WeeklyChart({ records }: Props) {
  const { profile, saveProfile } = useUserProfile();
  const goal = profile.weeklyGoalKm;

  const [tab, setTab] = useState<"weekly" | "monthly">("weekly");
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  function saveGoal(km: number) {
    const v = Math.max(1, Math.min(200, km));
    saveProfile({ ...profile, weeklyGoalKm: v });
    setEditing(false);
  }

  const days = getLast7Days();
  const weekData = days.map(({ date, label }) => {
    const km = records
      .filter((r) => r.created_at.slice(0, 10) === date)
      .reduce((s, r) => s + r.distance_km, 0);
    return { label, km: parseFloat(km.toFixed(2)) };
  });

  const monthDays = getCurrentMonthDays();
  const monthData = monthDays.map(({ date, label }) => {
    const km = records
      .filter((r) => r.created_at.slice(0, 10) === date)
      .reduce((s, r) => s + r.distance_km, 0);
    return { label, km: parseFloat(km.toFixed(2)) };
  });

  const weekTotal = weekData.reduce((s, d) => s + d.km, 0);
  const monthTotal = monthData.reduce((s, d) => s + d.km, 0);
  const monthRecords = records.filter((r) => {
    const now = new Date();
    const d = new Date(r.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthAvgPace =
    monthRecords.length > 0
      ? calcPace(
          monthRecords.reduce((s, r) => s + r.distance_km, 0),
          monthRecords.reduce((s, r) => s + r.duration_seconds, 0),
        )
      : 0;
  const monthTotalDuration = monthRecords.reduce((s, r) => s + r.duration_seconds, 0);

  const progress = Math.min(100, (weekTotal / goal) * 100);
  const accent = "var(--c-toss-blue)";

  const data = tab === "weekly" ? weekData : monthData;

  return (
    <div className="px-4 pt-3 space-y-3">
      {/* 주간 목표 카드 */}
      <div className="card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}>
            이번 주 목표
          </p>
          <button
            onClick={() => { setEditing((e) => !e); setInputVal(String(goal)); }}
            className="text-xs font-semibold h-11 px-3 rounded-full"
            style={{ background: "var(--c-elevated)", color: "var(--c-text-2)", border: "1px solid var(--c-border)" }}
          >
            {editing ? "취소" : "변경"}
          </button>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => saveGoal(p)}
                  className="flex-1 h-11 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: goal === p ? accent : "var(--c-elevated)",
                    color: goal === p ? "#fff" : "var(--c-text-2)",
                    border: goal === p ? "none" : "1px solid var(--c-border)",
                  }}
                >
                  {p}km
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={200}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold outline-none"
                style={{
                  background: "var(--c-elevated)",
                  border: "1px solid var(--c-border)",
                  color: "var(--c-text-1)",
                }}
                placeholder="직접 입력 (km)"
              />
              <button
                onClick={() => { const n = parseFloat(inputVal); if (!isNaN(n)) saveGoal(n); }}
                className="h-11 px-4 rounded-xl text-sm font-bold text-white"
                style={{ background: accent }}
              >
                저장
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="num" style={{ fontSize: 28, fontWeight: 800, color: "var(--c-text-1)", letterSpacing: "-0.03em" }}>
                {weekTotal.toFixed(1)}
              </span>
              <span style={{ fontSize: 14, color: "var(--c-text-3)" }}>/ {goal} km</span>
              <span
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: progress >= 100 ? "rgba(48,209,88,0.15)" : `${accent}18`,
                  color: progress >= 100 ? "var(--c-walk)" : accent,
                }}
              >
                {progress >= 100 ? "달성 🎉" : `${Math.round(progress)}%`}
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: "var(--c-elevated)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: progress >= 100 ? "var(--c-walk)" : accent }}
              />
            </div>
          </>
        )}
      </div>

      {/* 탭 + 차트 카드 */}
      <div className="card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--c-border)", background: "var(--c-elevated)" }}
          >
            {(["weekly", "monthly"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="h-11 px-3 text-xs font-semibold transition-all"
                style={{
                  background: tab === t ? accent : "transparent",
                  color: tab === t ? "#fff" : "var(--c-text-2)",
                }}
              >
                {t === "weekly" ? "주간" : "월간"}
              </button>
            ))}
          </div>
          {tab === "monthly" && monthTotal > 0 && (
            <span className="num text-xs" style={{ color: "var(--c-text-3)" }}>
              이달 {monthTotal.toFixed(1)} km
            </span>
          )}
        </div>

        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--c-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: tab === "monthly" ? 9 : 11, fill: "var(--c-text-3)" }}
              axisLine={false}
              tickLine={false}
              interval={tab === "monthly" ? 4 : 0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--c-text-3)" }}
              axisLine={false}
              tickLine={false}
              width={28}
              tickFormatter={(v) => v === 0 ? "" : `${v}`}
            />
            <Tooltip
              cursor={{ fill: "var(--c-elevated)" }}
              contentStyle={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--c-text-1)",
              }}
              formatter={(v) => [`${v ?? 0} km`, "거리"]}
            />
            <Bar dataKey="km" radius={[6, 6, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.km > 0 ? accent : "var(--c-elevated)"}
                />
              ))}
            </Bar>
            {tab === "weekly" && goal > 0 && (
              <ReferenceLine
                y={goal / 7}
                stroke="#f59e0b"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
            )}
          </BarChart>
        </ResponsiveContainer>

        {tab === "weekly" && (
          <p className="text-right mt-1" style={{ fontSize: 10, color: "var(--c-text-3)" }}>
            점선 = 목표 일일 평균 ({(goal / 7).toFixed(1)} km/일)
          </p>
        )}

        {tab === "monthly" && monthRecords.length > 0 && (
          <div className="grid grid-cols-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--c-border)" }}>
            {[
              { label: "활동", value: String(monthRecords.length), unit: "회" },
              { label: "시간", value: formatDuration(monthTotalDuration), unit: "" },
              { label: "평균 페이스", value: formatPace(monthAvgPace), unit: "/km" },
            ].map(({ label, value, unit }) => (
              <div key={label} className="text-center">
                <p style={{ fontSize: 10, color: "var(--c-text-3)", marginBottom: 2 }}>{label}</p>
                <span className="num" style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text-1)" }}>{value}</span>
                {unit && <span style={{ fontSize: 10, color: "var(--c-text-3)" }}> {unit}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
