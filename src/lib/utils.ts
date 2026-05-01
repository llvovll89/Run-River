export function formatDateFull(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatPace(pace: number): string {
  if (!pace || !isFinite(pace)) return "--'--\"";
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);
  return `${min}'${String(sec).padStart(2, "0")}"`;
}

export function calcPace(distanceKm: number, seconds: number): number {
  if (distanceKm === 0) return 0;
  return seconds / 60 / distanceKm;
}

/**
 * 현재 페이스(min/km)와 활동 유형으로 페이스존을 반환합니다.
 * 러닝: 빠름 <4:30, 적정 4:30–6:30, 느림 >6:30
 * 워킹: 빠름 <7:00, 적정 7:00–12:00, 느림 >12:00
 */
export function getPaceZone(
  pace: number,
  activityType: "running" | "walking"
): { label: string; color: string } {
  if (!pace || !isFinite(pace) || pace === 0) {
    return { label: "대기", color: "#636366" };
  }
  if (activityType === "running") {
    if (pace < 4.5)  return { label: "빠름", color: "#ff453a" };
    if (pace < 6.5)  return { label: "적정", color: "#30d158" };
    return            { label: "느림",  color: "#636366" };
  } else {
    if (pace < 7.0)  return { label: "빠름", color: "#ff453a" };
    if (pace < 12.0) return { label: "적정", color: "#30d158" };
    return            { label: "느림",  color: "#636366" };
  }
}
