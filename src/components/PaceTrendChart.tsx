"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { RunningRecord } from "@/types";
import { formatPace } from "@/lib/utils";

interface Props {
  records: RunningRecord[];
}

export default function PaceTrendChart({ records }: Props) {
  const recent = records
    .filter((r) => r.pace > 0 && r.distance_km >= 1)
    .slice(0, 10)
    .reverse();

  if (recent.length < 2) return null;

  const runRecords = recent.filter((r) => r.activity_type === "running");
  const walkRecords = recent.filter((r) => r.activity_type === "walking");
  const hasRun = runRecords.length >= 2;
  const hasWalk = walkRecords.length >= 2;
  if (!hasRun && !hasWalk) return null;

  const dates = recent.map((r) => {
    const d = new Date(r.created_at);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const data = recent.map((r, i) => ({
    label: dates[i],
    run: r.activity_type === "running" ? r.pace : null,
    walk: r.activity_type === "walking" ? r.pace : null,
  }));

  return (
    <div className="px-4 pt-3">
      <div
        className="card rounded-2xl p-4"
        style={{ paddingBottom: 8 }}
      >
        <p
          className="mb-3"
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--c-text-3)",
          }}
        >
          페이스 트렌드 (최근 {recent.length}회)
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--c-text-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--c-text-3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatPace(v)}
              reversed
            />
            <Tooltip
              contentStyle={{
                background: "var(--c-elevated)",
                border: "1px solid var(--c-border)",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                formatPace(Number(value)),
                name === "run" ? "러닝" : "워킹",
              ]}
            />
            {hasRun && (
              <Line
                type="monotone"
                dataKey="run"
                stroke="var(--c-toss-blue)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--c-toss-blue)" }}
                connectNulls
                name="run"
              />
            )}
            {hasWalk && (
              <Line
                type="monotone"
                dataKey="walk"
                stroke="var(--c-walk)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--c-walk)" }}
                connectNulls
                name="walk"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        {hasRun && hasWalk && (
          <div className="flex items-center gap-3 mt-1 justify-end">
            <div className="flex items-center gap-1">
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-toss-blue)" }} />
              <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>러닝</span>
            </div>
            <div className="flex items-center gap-1">
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-walk)" }} />
              <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>워킹</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
