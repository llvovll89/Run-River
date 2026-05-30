import type { RunningRecord } from "@/types";
import { formatPace, formatDuration } from "@/lib/utils";

export interface BadgeItem {
  key: string;
  title: string;
  description: string;
  icon: string;
}

export interface PersonalRecordItem {
  key: "distance" | "pace" | "duration";
  title: string;
  value: string;
}

interface MilestoneBadgeRule {
  key: string;
  threshold: number;
  title: string;
  description: string;
  icon: string;
}

export const ACTIVITY_BADGE_RULES: MilestoneBadgeRule[] = [
  { key: "activity_5", threshold: 5, title: "첫 루틴", description: "누적 5회 활동", icon: "🗓" },
  { key: "activity_10", threshold: 10, title: "꾸준한 러너", description: "누적 10회 활동", icon: "🔥" },
  { key: "activity_25", threshold: 25, title: "습관 완성", description: "누적 25회 활동", icon: "🏅" },
];

export const TOTAL_DISTANCE_BADGE_RULES: MilestoneBadgeRule[] = [
  { key: "total_10", threshold: 10, title: "10km 누적", description: "총 10km 달성", icon: "📍" },
  { key: "total_42195", threshold: 42.195, title: "첫 마라톤 누적", description: "총 42.195km 달성", icon: "🏁" },
  { key: "total_100", threshold: 100, title: "100km 클럽", description: "총 100km 달성", icon: "💯" },
];

export const SINGLE_DISTANCE_BADGE_RULES: MilestoneBadgeRule[] = [
  { key: "single_5", threshold: 5, title: "5km 완주", description: "단일 활동 5km 달성", icon: "🥉" },
  { key: "single_10", threshold: 10, title: "10km 완주", description: "단일 활동 10km 달성", icon: "🥈" },
  { key: "single_21", threshold: 21, title: "하프 도전", description: "단일 활동 21km 달성", icon: "🥇" },
];

export function resolveMilestoneBadges(
  prevValue: number,
  nextValue: number,
  rules: MilestoneBadgeRule[],
): BadgeItem[] {
  return rules
    .filter((rule) => prevValue < rule.threshold && nextValue >= rule.threshold)
    .map((rule) => ({ key: rule.key, title: rule.title, description: rule.description, icon: rule.icon }));
}

export function deriveAllBadges(records: RunningRecord[]): BadgeItem[] {
  if (records.length === 0) return [];

  const badges: BadgeItem[] = [];
  const totalCount = records.length;
  const totalDistance = records.reduce((s, r) => s + r.distance_km, 0);
  const maxSingleDistance = Math.max(...records.map((r) => r.distance_km));

  badges.push(
    ...ACTIVITY_BADGE_RULES.filter((r) => totalCount >= r.threshold).map((r) => ({
      key: r.key, title: r.title, description: r.description, icon: r.icon,
    })),
  );
  badges.push(
    ...TOTAL_DISTANCE_BADGE_RULES.filter((r) => totalDistance >= r.threshold).map((r) => ({
      key: r.key, title: r.title, description: r.description, icon: r.icon,
    })),
  );
  badges.push(
    ...SINGLE_DISTANCE_BADGE_RULES.filter((r) => maxSingleDistance >= r.threshold).map((r) => ({
      key: r.key, title: r.title, description: r.description, icon: r.icon,
    })),
  );

  badges.push({ key: "first_activity", title: "첫 발자국", description: "첫 활동 기록 저장 완료", icon: "🌱" });

  return badges;
}

export function derivePerformance(
  current: RunningRecord,
  records: RunningRecord[],
): { personalRecords: PersonalRecordItem[]; earnedBadges: BadgeItem[] } {
  const previousRecords = records.filter((r) => r.id !== current.id);
  const previousSameActivity = previousRecords.filter((r) => r.activity_type === current.activity_type);
  const personalRecords: PersonalRecordItem[] = [];

  const prevMaxDistance =
    previousSameActivity.length > 0
      ? Math.max(...previousSameActivity.map((r) => r.distance_km))
      : 0;
  if (previousSameActivity.length === 0 || current.distance_km > prevMaxDistance + 0.0001) {
    personalRecords.push({ key: "distance", title: "최장 거리 PR", value: `${current.distance_km.toFixed(2)}km` });
  }

  const paceCandidates = previousSameActivity.filter((r) => r.distance_km >= 1 && r.duration_seconds >= 300);
  const hasCurrentPaceCandidate = current.distance_km >= 1 && current.duration_seconds >= 300;
  const prevBestPace =
    paceCandidates.length > 0
      ? Math.min(...paceCandidates.map((r) => r.pace))
      : Number.POSITIVE_INFINITY;
  if (hasCurrentPaceCandidate && (paceCandidates.length === 0 || current.pace < prevBestPace - 0.0001)) {
    personalRecords.push({ key: "pace", title: "최고 페이스 PR", value: `${formatPace(current.pace)}/km` });
  }

  const prevMaxDuration =
    previousSameActivity.length > 0
      ? Math.max(...previousSameActivity.map((r) => r.duration_seconds))
      : 0;
  if (previousSameActivity.length === 0 || current.duration_seconds > prevMaxDuration) {
    personalRecords.push({ key: "duration", title: "최장 시간 PR", value: formatDuration(current.duration_seconds) });
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
    earnedBadges.push({ key: "first_activity", title: "첫 발자국", description: "첫 활동 기록 저장 완료", icon: "🌱" });
  }

  return { personalRecords, earnedBadges };
}
