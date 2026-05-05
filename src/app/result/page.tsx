"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { saveRunningRecord, deleteRunningRecord, updateRunningMemo, getRunningHistory } from "@/lib/supabase";
import { enqueue } from "@/lib/offlineQueue";
import { formatDuration, formatPace, formatDateFull, calcPace, getPaceZone } from "@/lib/utils";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import type { LatLng, ActivityType, RunningRecord, TrackPoint, IntervalPreset } from "@/types";
import { useUserProfile } from "@/hooks/useUserProfile";

const KakaoMap = dynamic(() => import("@/components/KakaoMap"), { ssr: false });

interface RunResult {
  startPoint: LatLng;
  endPoint: LatLng;
  distance_km: number;
  duration_seconds: number;
  pace: number;
  activity_type: ActivityType;
  pathPoints?: LatLng[];
  trackPoints?: TrackPoint[];
  altitude_start_m?: number | null;
  altitude_end_m?: number | null;
  elevation_gain_m?: number | null;
  elevation_loss_m?: number | null;
  intervalPreset?: IntervalPreset;
  intervalCompletedSets?: number;
  intervalTotalRunSeconds?: number;
  intervalTotalRestSeconds?: number;
}

interface AltitudePoint {
  x: number;
  altitude: number;
}

interface PaceZoneSummary {
  label: "빠름" | "적정" | "느림";
  color: string;
  seconds: number;
  ratio: number;
}

interface SplitRow {
  key: string;
  label: string;
  segmentDistanceKm: number;
  segmentSeconds: number;
  cumulativeDistanceKm: number;
  cumulativeSeconds: number;
  pace: number;
}

interface Segment {
  distanceKm: number;
  seconds: number;
}

interface RunAnalysis {
  altitudeByDistance: AltitudePoint[];
  altitudeByTime: AltitudePoint[];
  paceZones: PaceZoneSummary[];
  distanceSplits: SplitRow[];
  timeSplits: SplitRow[];
}

interface PersonalRecordItem {
  key: "distance" | "pace" | "duration";
  title: string;
  value: string;
}

interface BadgeItem {
  key: string;
  title: string;
  description: string;
  icon: string;
}

interface MilestoneBadgeRule {
  key: string;
  threshold: number;
  title: string;
  description: string;
  icon: string;
}

const ACTIVITY_BADGE_RULES: MilestoneBadgeRule[] = [
  { key: "activity_5", threshold: 5, title: "첫 루틴", description: "누적 5회 활동", icon: "🗓" },
  { key: "activity_10", threshold: 10, title: "꾸준한 러너", description: "누적 10회 활동", icon: "🔥" },
  { key: "activity_25", threshold: 25, title: "습관 완성", description: "누적 25회 활동", icon: "🏅" },
];

const TOTAL_DISTANCE_BADGE_RULES: MilestoneBadgeRule[] = [
  { key: "total_10", threshold: 10, title: "10km 누적", description: "총 10km 달성", icon: "📍" },
  { key: "total_42195", threshold: 42.195, title: "첫 마라톤 누적", description: "총 42.195km 달성", icon: "🏁" },
  { key: "total_100", threshold: 100, title: "100km 클럽", description: "총 100km 달성", icon: "💯" },
];

const SINGLE_DISTANCE_BADGE_RULES: MilestoneBadgeRule[] = [
  { key: "single_5", threshold: 5, title: "5km 완주", description: "단일 활동 5km 달성", icon: "🥉" },
  { key: "single_10", threshold: 10, title: "10km 완주", description: "단일 활동 10km 달성", icon: "🥈" },
  { key: "single_21", threshold: 21, title: "하프 도전", description: "단일 활동 21km 달성", icon: "🥇" },
];

function compressPoints<T>(points: T[], maxPoints = 120): T[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, idx) => idx % step === 0 || idx === points.length - 1);
}

function buildDistanceSplits(segments: Segment[]): SplitRow[] {
  const rows: SplitRow[] = [];
  const targetKm = 1;
  let splitIndex = 1;
  let leftToBoundary = targetKm;
  let segmentDistance = 0;
  let segmentSeconds = 0;
  let cumulativeDistance = 0;
  let cumulativeSeconds = 0;

  for (const seg of segments) {
    let leftDistance = seg.distanceKm;
    let leftSeconds = seg.seconds;

    while (leftDistance > 0.000001) {
      const takeDistance = Math.min(leftDistance, leftToBoundary);
      const ratio = leftDistance > 0 ? takeDistance / leftDistance : 0;
      const takeSeconds = leftSeconds * ratio;

      segmentDistance += takeDistance;
      segmentSeconds += takeSeconds;
      cumulativeDistance += takeDistance;
      cumulativeSeconds += takeSeconds;

      leftDistance -= takeDistance;
      leftSeconds -= takeSeconds;
      leftToBoundary -= takeDistance;

      if (leftToBoundary <= 0.000001) {
        rows.push({
          key: `km-${splitIndex}`,
          label: `${splitIndex}km`,
          segmentDistanceKm: segmentDistance,
          segmentSeconds,
          cumulativeDistanceKm: cumulativeDistance,
          cumulativeSeconds,
          pace: calcPace(segmentDistance, segmentSeconds),
        });
        splitIndex += 1;
        leftToBoundary = targetKm;
        segmentDistance = 0;
        segmentSeconds = 0;
      }
    }
  }

  if (segmentDistance >= 0.05) {
    rows.push({
      key: `km-partial-${splitIndex}`,
      label: `${splitIndex}km+`,
      segmentDistanceKm: segmentDistance,
      segmentSeconds,
      cumulativeDistanceKm: cumulativeDistance,
      cumulativeSeconds,
      pace: calcPace(segmentDistance, segmentSeconds),
    });
  }

  return rows;
}

function buildTimeSplits(segments: Segment[]): SplitRow[] {
  const rows: SplitRow[] = [];
  const targetSeconds = 300;
  let splitIndex = 1;
  let leftToBoundary = targetSeconds;
  let segmentDistance = 0;
  let segmentSeconds = 0;
  let cumulativeDistance = 0;
  let cumulativeSeconds = 0;

  for (const seg of segments) {
    let leftDistance = seg.distanceKm;
    let leftSeconds = seg.seconds;

    while (leftSeconds > 0.000001) {
      const takeSeconds = Math.min(leftSeconds, leftToBoundary);
      const ratio = leftSeconds > 0 ? takeSeconds / leftSeconds : 0;
      const takeDistance = leftDistance * ratio;

      segmentDistance += takeDistance;
      segmentSeconds += takeSeconds;
      cumulativeDistance += takeDistance;
      cumulativeSeconds += takeSeconds;

      leftDistance -= takeDistance;
      leftSeconds -= takeSeconds;
      leftToBoundary -= takeSeconds;

      if (leftToBoundary <= 0.000001) {
        rows.push({
          key: `time-${splitIndex}`,
          label: `${splitIndex * 5}분`,
          segmentDistanceKm: segmentDistance,
          segmentSeconds,
          cumulativeDistanceKm: cumulativeDistance,
          cumulativeSeconds,
          pace: calcPace(segmentDistance, segmentSeconds),
        });
        splitIndex += 1;
        leftToBoundary = targetSeconds;
        segmentDistance = 0;
        segmentSeconds = 0;
      }
    }
  }

  if (segmentSeconds >= 30) {
    rows.push({
      key: `time-partial-${splitIndex}`,
      label: `${splitIndex * 5}분+`,
      segmentDistanceKm: segmentDistance,
      segmentSeconds,
      cumulativeDistanceKm: cumulativeDistance,
      cumulativeSeconds,
      pace: calcPace(segmentDistance, segmentSeconds),
    });
  }

  return rows;
}

function deriveRunAnalysis(result: RunResult): RunAnalysis | null {
  const points = result.trackPoints ?? [];
  if (points.length < 2) return null;

  const segments: Segment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const distanceKm = curr.distance_km - prev.distance_km;
    const seconds = curr.elapsed_seconds - prev.elapsed_seconds;
    if (distanceKm > 0 && seconds > 0) {
      segments.push({ distanceKm, seconds });
    }
  }

  if (segments.length === 0) return null;

  const rawAltitudeByDistance = points
    .filter((p) => p.altitude_m !== null)
    .map((p) => ({ x: p.distance_km, altitude: Math.round(p.altitude_m as number) }));
  const rawAltitudeByTime = points
    .filter((p) => p.altitude_m !== null)
    .map((p) => ({ x: p.elapsed_seconds / 60, altitude: Math.round(p.altitude_m as number) }));

  const zoneSeconds: Record<"빠름" | "적정" | "느림", number> = { 빠름: 0, 적정: 0, 느림: 0 };
  for (const seg of segments) {
    const pace = calcPace(seg.distanceKm, seg.seconds);
    const zone = getPaceZone(pace, result.activity_type).label;
    if (zone === "빠름" || zone === "적정" || zone === "느림") {
      zoneSeconds[zone] += seg.seconds;
    }
  }

  const totalZoneSeconds = zoneSeconds.빠름 + zoneSeconds.적정 + zoneSeconds.느림;
  const zoneOrder: Array<"빠름" | "적정" | "느림"> = ["빠름", "적정", "느림"];
  const paceZones: PaceZoneSummary[] = zoneOrder.map((label) => {
    const samplePace = label === "빠름" ? (result.activity_type === "running" ? 4 : 6) : label === "적정" ? (result.activity_type === "running" ? 5.5 : 9) : (result.activity_type === "running" ? 7.5 : 13);
    const color = getPaceZone(samplePace, result.activity_type).color;
    const seconds = zoneSeconds[label];
    return {
      label,
      color,
      seconds,
      ratio: totalZoneSeconds > 0 ? seconds / totalZoneSeconds : 0,
    };
  });

  return {
    altitudeByDistance: compressPoints(rawAltitudeByDistance),
    altitudeByTime: compressPoints(rawAltitudeByTime),
    paceZones,
    distanceSplits: buildDistanceSplits(segments),
    timeSplits: buildTimeSplits(segments),
  };
}

function resolveMilestoneBadges(prevValue: number, nextValue: number, rules: MilestoneBadgeRule[]): BadgeItem[] {
  return rules
    .filter((rule) => prevValue < rule.threshold && nextValue >= rule.threshold)
    .map((rule) => ({
      key: rule.key,
      title: rule.title,
      description: rule.description,
      icon: rule.icon,
    }));
}

function derivePerformance(current: RunningRecord, records: RunningRecord[]): { personalRecords: PersonalRecordItem[]; earnedBadges: BadgeItem[] } {
  const previousRecords = records.filter((r) => r.id !== current.id);
  const previousSameActivity = previousRecords.filter((r) => r.activity_type === current.activity_type);

  const personalRecords: PersonalRecordItem[] = [];

  const prevMaxDistance = previousSameActivity.length > 0
    ? Math.max(...previousSameActivity.map((r) => r.distance_km))
    : 0;
  if (previousSameActivity.length === 0 || current.distance_km > prevMaxDistance + 0.0001) {
    personalRecords.push({
      key: "distance",
      title: "최장 거리 PR",
      value: `${current.distance_km.toFixed(2)}km`,
    });
  }

  const paceCandidates = previousSameActivity.filter((r) => r.distance_km >= 1 && r.duration_seconds >= 300);
  const hasCurrentPaceCandidate = current.distance_km >= 1 && current.duration_seconds >= 300;
  const prevBestPace = paceCandidates.length > 0 ? Math.min(...paceCandidates.map((r) => r.pace)) : Number.POSITIVE_INFINITY;
  if (hasCurrentPaceCandidate && (paceCandidates.length === 0 || current.pace < prevBestPace - 0.0001)) {
    personalRecords.push({
      key: "pace",
      title: "최고 페이스 PR",
      value: `${formatPace(current.pace)}/km`,
    });
  }

  const prevMaxDuration = previousSameActivity.length > 0
    ? Math.max(...previousSameActivity.map((r) => r.duration_seconds))
    : 0;
  if (previousSameActivity.length === 0 || current.duration_seconds > prevMaxDuration) {
    personalRecords.push({
      key: "duration",
      title: "최장 시간 PR",
      value: formatDuration(current.duration_seconds),
    });
  }

  const prevCount = previousRecords.length;
  const nextCount = records.length;
  const prevTotalDistance = previousRecords.reduce((sum, r) => sum + r.distance_km, 0);
  const nextTotalDistance = records.reduce((sum, r) => sum + r.distance_km, 0);

  const earnedBadges: BadgeItem[] = [];
  earnedBadges.push(...resolveMilestoneBadges(prevCount, nextCount, ACTIVITY_BADGE_RULES));
  earnedBadges.push(...resolveMilestoneBadges(prevTotalDistance, nextTotalDistance, TOTAL_DISTANCE_BADGE_RULES));
  earnedBadges.push(...resolveMilestoneBadges(0, current.distance_km, SINGLE_DISTANCE_BADGE_RULES));

  if (prevCount === 0) {
    earnedBadges.push({
      key: "first_activity",
      title: "첫 발자국",
      description: "첫 활동 기록 저장 완료",
      icon: "🌱",
    });
  }

  return { personalRecords, earnedBadges };
}

export default function ResultPage() {
  const MEMO_MAX_LENGTH = 300;
  const router = useRouter();
  const { profile } = useUserProfile();
  const [result, setResult] = useState<RunResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [memo, setMemo] = useState("");
  const [lastSavedMemo, setLastSavedMemo] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [memoStatus, setMemoStatus] = useState<"idle" | "success" | "error">("idle");
  const [personalRecords, setPersonalRecords] = useState<PersonalRecordItem[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<BadgeItem[]>([]);
  const [shareStatus, setShareStatus] = useState<"idle" | "success" | "error">("idle");
  const [altitudeMode, setAltitudeMode] = useState<"distance" | "time">("distance");
  const [splitMode, setSplitMode] = useState<"distance" | "time">("distance");

  const doSave = useCallback((parsed: RunResult) => {
    setSaving(true);
    setSaveError(false);
    setOfflineSaved(false);
    const payload = {
      start_point: parsed.startPoint,
      end_point: parsed.endPoint,
      distance_km: parsed.distance_km,
      duration_seconds: parsed.duration_seconds,
      pace: parsed.pace,
      activity_type: parsed.activity_type,
      altitude_start_m: parsed.altitude_start_m ?? null,
      altitude_end_m: parsed.altitude_end_m ?? null,
      elevation_gain_m: parsed.elevation_gain_m ?? null,
      elevation_loss_m: parsed.elevation_loss_m ?? null,
    };
    saveRunningRecord(payload)
      .then(async (record) => {
        setSavedId(record.id);
        setLastSavedMemo(record.memo ?? "");

        const records = await getRunningHistory();
        const { personalRecords: prs, earnedBadges: badges } = derivePerformance(record, records);
        setPersonalRecords(prs);
        setEarnedBadges(badges);

        sessionStorage.removeItem("runResult");
        sessionStorage.removeItem("runConfig");
      })
      .catch(() => {
        enqueue(payload);
        setOfflineSaved(true);
      })
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

  const handleShare = useCallback(async () => {
    if (!result) return;

    const activityLabel = result.activity_type === "running" ? "러닝" : "워킹";
    const prText = personalRecords.length > 0
      ? `\nPR: ${personalRecords.map((item) => `${item.title} (${item.value})`).join(", ")}`
      : "";
    const badgeText = earnedBadges.length > 0
      ? `\n배지: ${earnedBadges.slice(0, 3).map((badge) => badge.title).join(", ")}`
      : "";

    const shareText = [
      `Run River ${activityLabel} 완료`,
      `거리 ${result.distance_km.toFixed(2)}km`,
      `시간 ${formatDuration(result.duration_seconds)}`,
      `페이스 ${formatPace(result.pace)}/km`,
    ].join(" | ") + prText + badgeText;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Run River 기록 공유",
          text: shareText,
          url: `${window.location.origin}/history`,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      setShareStatus("success");
    } catch {
      setShareStatus("error");
    }
  }, [result, personalRecords, earnedBadges]);

  const analysis = useMemo(() => (result ? deriveRunAnalysis(result) : null), [result]);

  if (!result) return null;

  const isRun = result.activity_type === "running";
  const accent = isRun ? "var(--c-toss-blue)" : "var(--c-walk)";
  const label = isRun ? "러닝" : "워킹";

  const dateStr = formatDateFull(new Date());

  const calories = Math.round((isRun ? 8.0 : 3.5) * profile.weight * (result.duration_seconds / 3600));
  const strideCm = profile.height * (isRun ? 0.415 : 0.413);
  const steps = Math.round((result.distance_km * 100000) / strideCm);
  const elevationGain = result.elevation_gain_m ?? null;
  const elevationLoss = result.elevation_loss_m ?? null;
  const hasElevation = elevationGain !== null || elevationLoss !== null;

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
            ) : offlineSaved ? (
              <span className="text-xs font-semibold" style={{ color: "var(--c-text-2)" }}>오프라인 저장됨 · 연결 시 자동 업로드</span>
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
              { label: "소요 시간", value: formatDuration(result.duration_seconds), unit: "" },
              { label: "평균 페이스", value: formatPace(result.pace), unit: "/km" },
              { label: "거리", value: result.distance_km.toFixed(2), unit: "km" },
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

      {/* 고도 프로필 */}
      {analysis && (analysis.altitudeByDistance.length > 1 || analysis.altitudeByTime.length > 1) && (
        <div className="px-4 mt-3">
          <div className="card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p
                style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}
              >
                고도 프로필
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAltitudeMode("distance")}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: altitudeMode === "distance" ? `${accent}22` : "var(--c-elevated)",
                    color: altitudeMode === "distance" ? accent : "var(--c-text-2)",
                    border: altitudeMode === "distance" ? `1px solid ${accent}44` : "1px solid var(--c-border)",
                  }}
                >
                  거리
                </button>
                <button
                  onClick={() => setAltitudeMode("time")}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: altitudeMode === "time" ? `${accent}22` : "var(--c-elevated)",
                    color: altitudeMode === "time" ? accent : "var(--c-text-2)",
                    border: altitudeMode === "time" ? `1px solid ${accent}44` : "1px solid var(--c-border)",
                  }}
                >
                  시간
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={altitudeMode === "distance" ? analysis.altitudeByDistance : analysis.altitudeByTime}>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="x"
                  tick={{ fontSize: 11, fill: "var(--c-text-3)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => altitudeMode === "distance" ? `${value.toFixed(1)}km` : `${Math.round(value)}m`}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--c-text-3)" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(value: number) => `${Math.round(value)}m`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--c-surface)",
                    border: "1px solid var(--c-border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--c-text-1)",
                  }}
                  formatter={(value) => [`${Math.round(Number(value ?? 0))}m`, "고도"]}
                  labelFormatter={(label) => {
                    const xValue = Number(label ?? 0);
                    return altitudeMode === "distance"
                      ? `거리 ${xValue.toFixed(2)}km`
                      : `시간 ${formatDuration(Math.round(xValue * 60))}`;
                  }}
                />
                <Line type="monotone" dataKey="altitude" stroke={accent} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 페이스 존 분석 */}
      {analysis && (
        <div className="px-4 mt-3">
          <div className="card rounded-2xl p-4">
            <p
              className="mb-3"
              style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}
            >
              페이스 존 누적 시간
            </p>
            <div className="space-y-2.5">
              {analysis.paceZones.map((zone) => (
                <div key={zone.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>{zone.label}</span>
                    <span className="num" style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-1)" }}>
                      {formatDuration(Math.round(zone.seconds))} ({Math.round(zone.ratio * 100)}%)
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 6, background: "var(--c-elevated)" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.round(zone.ratio * 100))}%`,
                        background: zone.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 스플릿 분석 */}
      {analysis && (analysis.distanceSplits.length > 0 || analysis.timeSplits.length > 0) && (
        <div className="px-4 mt-3">
          <div className="card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p
                style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}
              >
                스플릿 분석
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSplitMode("distance")}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: splitMode === "distance" ? `${accent}22` : "var(--c-elevated)",
                    color: splitMode === "distance" ? accent : "var(--c-text-2)",
                    border: splitMode === "distance" ? `1px solid ${accent}44` : "1px solid var(--c-border)",
                  }}
                >
                  1km
                </button>
                <button
                  onClick={() => setSplitMode("time")}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: splitMode === "time" ? `${accent}22` : "var(--c-elevated)",
                    color: splitMode === "time" ? accent : "var(--c-text-2)",
                    border: splitMode === "time" ? `1px solid ${accent}44` : "1px solid var(--c-border)",
                  }}
                >
                  5분
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 11, color: "var(--c-text-3)", fontWeight: 600, textAlign: "left", paddingBottom: 8 }}>구간</th>
                    <th style={{ fontSize: 11, color: "var(--c-text-3)", fontWeight: 600, textAlign: "right", paddingBottom: 8 }}>거리</th>
                    <th style={{ fontSize: 11, color: "var(--c-text-3)", fontWeight: 600, textAlign: "right", paddingBottom: 8 }}>시간</th>
                    <th style={{ fontSize: 11, color: "var(--c-text-3)", fontWeight: 600, textAlign: "right", paddingBottom: 8 }}>페이스</th>
                    <th style={{ fontSize: 11, color: "var(--c-text-3)", fontWeight: 600, textAlign: "right", paddingBottom: 8 }}>누적</th>
                  </tr>
                </thead>
                <tbody>
                  {(splitMode === "distance" ? analysis.distanceSplits : analysis.timeSplits).map((split) => (
                    <tr key={split.key} style={{ borderTop: "1px solid var(--c-border)" }}>
                      <td style={{ fontSize: 13, color: "var(--c-text-2)", padding: "8px 0" }}>{split.label}</td>
                      <td className="num" style={{ fontSize: 13, color: "var(--c-text-1)", textAlign: "right", padding: "8px 0" }}>
                        {split.segmentDistanceKm.toFixed(2)}km
                      </td>
                      <td className="num" style={{ fontSize: 13, color: "var(--c-text-1)", textAlign: "right", padding: "8px 0" }}>
                        {formatDuration(Math.round(split.segmentSeconds))}
                      </td>
                      <td className="num" style={{ fontSize: 13, color: accent, textAlign: "right", fontWeight: 700, padding: "8px 0" }}>
                        {formatPace(split.pace)}
                      </td>
                      <td className="num" style={{ fontSize: 13, color: "var(--c-text-2)", textAlign: "right", padding: "8px 0" }}>
                        {split.cumulativeDistanceKm.toFixed(2)}km / {formatDuration(Math.round(split.cumulativeSeconds))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
            { label: "활동 유형", value: label },
            { label: "예상 칼로리", value: `${calories.toLocaleString()} kcal` },
            { label: "예상 걸음 수", value: `${steps.toLocaleString()} 보` },
            ...(hasElevation
              ? [{ label: "누적 상승/하강", value: `${Math.round(elevationGain ?? 0)}m / ${Math.round(elevationLoss ?? 0)}m` }]
              : []),
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
            * 칼로리: MET × 체중({profile.weight}kg) × 시간 기반 추정치
          </p>
        </div>
      </div>

      {/* 인터벌 요약 */}
      {result.intervalPreset && (
        <div className="px-4 mt-3">
          <div className="card rounded-2xl p-4">
            <p
              className="mb-3"
              style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}
            >
              인터벌 트레이닝
            </p>
            <p className="font-bold mb-3" style={{ fontSize: 15, color: accent }}>{result.intervalPreset.name}</p>
            <div className="space-y-2">
              {result.intervalPreset.sets > 0 && (
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>완료 세트</span>
                  <span className="num font-bold" style={{ fontSize: 14, color: "var(--c-text-1)" }}>
                    {result.intervalCompletedSets ?? 0} / {result.intervalPreset.sets}세트
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>달리기 시간</span>
                <span className="num font-bold" style={{ fontSize: 14, color: "var(--c-toss-blue)" }}>
                  {formatDuration(result.intervalTotalRunSeconds ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>휴식 시간</span>
                <span className="num font-bold" style={{ fontSize: 14, color: "var(--c-walk)" }}>
                  {formatDuration(result.intervalTotalRestSeconds ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PR 기록 */}
      {personalRecords.length > 0 && (
        <div className="px-4 mt-3">
          <div className="card rounded-2xl p-4">
            <p
              className="mb-3"
              style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}
            >
              개인 최고 기록
            </p>
            <div className="space-y-2">
              {personalRecords.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-xl px-3 py-2"
                  style={{ background: `${accent}12`, border: `1px solid ${accent}33` }}
                >
                  <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>{item.title}</span>
                  <span className="num" style={{ fontSize: 14, fontWeight: 700, color: accent }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 배지 시스템 */}
      {earnedBadges.length > 0 && (
        <div className="px-4 mt-3">
          <div className="card rounded-2xl p-4">
            <p
              className="mb-3"
              style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-3)" }}
            >
              이번에 획득한 배지
            </p>
            <div className="grid grid-cols-1 gap-2">
              {earnedBadges.map((badge) => (
                <div
                  key={badge.key}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                  style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}
                >
                  <span style={{ fontSize: 20 }} aria-hidden>{badge.icon}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-1)" }}>{badge.title}</p>
                    <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
        <button
          onClick={handleShare}
          disabled={saving || !savedId}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
          style={{
            background: accent,
            color: "#fff",
            opacity: saving || !savedId ? 0.6 : 1,
            letterSpacing: "-0.01em",
            boxShadow: `0 4px 20px ${accent}44`,
          }}
        >
          기록 공유하기
        </button>
        {shareStatus === "success" && (
          <p className="text-center" style={{ fontSize: 12, color: "var(--c-walk)" }}>
            공유 완료!
          </p>
        )}
        {shareStatus === "error" && (
          <p className="text-center" style={{ fontSize: 12, color: "var(--c-danger)" }}>
            공유에 실패했어요. 다시 시도해주세요.
          </p>
        )}
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

