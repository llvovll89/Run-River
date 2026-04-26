import { getRunningHistory } from "@/lib/supabase";
import { formatDuration, formatPace } from "@/lib/utils";
import Link from "next/link";
import type { RunningRecord } from "@/types";

export const revalidate = 0;

export default async function HistoryPage() {
  let records: RunningRecord[] = [];
  let error = "";

  try {
    records = await getRunningHistory();
  } catch {
    error = "기록을 불러올 수 없습니다. Supabase 설정을 확인하세요.";
  }

  const totalRuns = records.length;
  const totalDistance = records.reduce((sum, r) => sum + r.distance_km, 0);
  const runDays = new Set(records.map((r) => r.created_at.slice(0, 10))).size;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-blue-600 text-white px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-white/80 text-sm">
          ← 홈
        </Link>
        <h1 className="text-lg font-bold">기록</h1>
      </header>

      {/* 요약 */}
      {totalRuns > 0 && (
        <div className="bg-white mx-4 mt-4 rounded-2xl shadow p-4 grid grid-cols-3 gap-3 text-center">
          <SummaryStat label="총 활동" value={String(totalRuns)} unit="회" />
          <SummaryStat label="총 거리" value={totalDistance.toFixed(1)} unit="km" />
          <SummaryStat label="활동 일수" value={String(runDays)} unit="일" />
        </div>
      )}

      {/* 리스트 */}
      <div className="px-4 py-4 space-y-3">
        {error && (
          <p className="text-center text-red-500 text-sm mt-8">{error}</p>
        )}
        {!error && records.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-12">
            아직 기록이 없습니다.
          </p>
        )}
        {records.map((record) => (
          <RecordCard key={record.id} record={record} />
        ))}
      </div>
    </main>
  );
}

function RecordCard({ record }: { record: RunningRecord }) {
  const isRunning = record.activity_type === "running";
  const date = new Date(record.created_at);
  const dateStr = date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
  const timeStr = date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{isRunning ? "🏃" : "🚶"}</span>
          <span className="text-sm font-semibold text-gray-700">
            {isRunning ? "러닝" : "워킹"}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{dateStr}</p>
          <p className="text-xs text-gray-400">{timeStr}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-gray-400">거리</p>
          <p className="text-base font-bold text-gray-900">
            {record.distance_km.toFixed(2)}
            <span className="text-xs font-normal text-gray-400 ml-0.5">km</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">시간</p>
          <p className="text-base font-bold text-gray-900">
            {formatDuration(record.duration_seconds)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">페이스</p>
          <p className="text-base font-bold text-gray-900">
            {formatPace(record.pace)}
            <span className="text-xs font-normal text-gray-400 ml-0.5">/km</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900">
        {value}
        <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
      </p>
    </div>
  );
}
