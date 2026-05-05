"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import type { RunningRecord } from "@/types";
import { useUserProfile } from "@/hooks/useUserProfile";

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

export default function WeeklyChart({ records }: Props) {
  const { profile, saveProfile } = useUserProfile();
  const goal = profile.weeklyGoalKm;

  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  function saveGoal(km: number) {
    const v = Math.max(1, Math.min(200, km));
    saveProfile({ ...profile, weeklyGoalKm: v });
    setEditing(false);
  }

  const days = getLast7Days();
  const data = days.map(({ date, label }) => {
    const km = records
      .filter((r) => r.created_at.slice(0, 10) === date)
      .reduce((s, r) => s + r.distance_km, 0);
    return { label, km: parseFloat(km.toFixed(2)) };
  });

  const weekTotal = data.reduce((s, d) => s + d.km, 0);
  const progress  = Math.min(100, (weekTotal / goal) * 100);
  const accent    = "var(--c-toss-blue)";

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
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
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
                  className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
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
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
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

      {/* 바 차트 카드 */}
      <div className="card rounded-2xl p-4">
        <p
          className="mb-4"
          style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}
        >
          최근 7일 거리
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--c-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--c-text-3)" }}
              axisLine={false}
              tickLine={false}
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
                  fill={entry.km > 0 ? "var(--c-toss-blue)" : "var(--c-elevated)"}
                />
              ))}
            </Bar>
            {goal > 0 && (
              <ReferenceLine
                y={goal / 7}
                stroke="#f59e0b"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
        <p className="text-right mt-1" style={{ fontSize: 10, color: "var(--c-text-3)" }}>
          점선 = 목표 일일 평균 ({(goal / 7).toFixed(1)} km/일)
        </p>
      </div>
    </div>
  );
}
