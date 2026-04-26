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
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("runResult");
    if (!raw) {
      router.replace("/");
      return;
    }
    setResult(JSON.parse(raw));
  }, [router]);

  async function handleSave() {
    if (!result || saved) return;
    setSaving(true);
    try {
      await saveRunningRecord({
        start_point: result.startPoint,
        end_point: result.endPoint,
        distance_km: result.distance_km,
        duration_seconds: result.duration_seconds,
        pace: result.pace,
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

  const activityLabel = result.activity_type === "running" ? "🏃 러닝" : "🚶 워킹";
  const accentColor =
    result.activity_type === "running" ? "bg-blue-600" : "bg-green-500";

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className={`${accentColor} text-white px-4 py-8 text-center`}>
        <p className="text-5xl mb-2">🏁</p>
        <h1 className="text-2xl font-bold">{activityLabel} 완료!</h1>
        <p className="text-sm text-white/70 mt-1">
          {new Date().toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* 결과 카드 */}
      <div className="flex-1 px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl shadow p-5 grid grid-cols-3 gap-4 text-center">
          <ResultStat
            label="총 거리"
            value={result.distance_km.toFixed(2)}
            unit="km"
          />
          <ResultStat
            label="소요 시간"
            value={formatDuration(result.duration_seconds)}
            unit=""
          />
          <ResultStat
            label="평균 페이스"
            value={formatPace(result.pace)}
            unit="/km"
          />
        </div>

        {/* 저장 버튼 */}
        {!saved ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-4 ${accentColor} text-white rounded-xl font-bold text-base disabled:opacity-60`}
          >
            {saving ? "저장 중..." : "기록 저장"}
          </button>
        ) : (
          <div className="w-full py-4 bg-gray-100 text-green-600 rounded-xl font-bold text-base text-center">
            ✓ 저장 완료
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/history")}
            className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold text-sm"
          >
            기록 보기
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold text-sm"
          >
            다시 시작
          </button>
        </div>
      </div>
    </main>
  );
}

function ResultStat({
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
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">
        {value}
        {unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
