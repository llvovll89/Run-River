import {getRunningHistoryServer} from "@/lib/supabaseServer";
import {
    formatDuration,
    formatPace,
    formatDateShort,
    formatTime,
    calcCaloriesByPace,
} from "@/lib/utils";
import Link from "next/link";
import type {RunningRecord} from "@/types";
import WeeklyChart from "@/components/WeeklyChart";
import PaceTrendChart from "@/components/PaceTrendChart";
import DeleteRecordButton from "@/components/DeleteRecordButton";
import EditableMemo from "@/components/EditableMemo";
import {deriveAllBadges} from "@/lib/badges";

export const revalidate = 0;

function parseDayLocal(day: string): Date {
    const [year, month, date] = day.split("-").map(Number);
    return new Date(year, (month ?? 1) - 1, date ?? 1);
}

function calcCurrentStreak(records: RunningRecord[]): number {
    if (records.length === 0) return 0;

    const uniqueDays = Array.from(
        new Set(records.map((record) => record.created_at.slice(0, 10))),
    ).sort((a, b) => b.localeCompare(a));

    if (uniqueDays.length === 0) return 0;

    const today = new Date();
    const todayDateOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );
    const latestDate = parseDayLocal(uniqueDays[0]);
    const latestDiffDays = Math.floor(
        (todayDateOnly.getTime() - latestDate.getTime()) / 86400000,
    );

    if (latestDiffDays > 1) return 0;

    let streak = 1;
    let prevDate = latestDate;
    for (let idx = 1; idx < uniqueDays.length; idx += 1) {
        const currentDate = parseDayLocal(uniqueDays[idx]);
        const diffDays = Math.floor(
            (prevDate.getTime() - currentDate.getTime()) / 86400000,
        );
        if (diffDays !== 1) break;
        streak += 1;
        prevDate = currentDate;
    }

    return streak;
}

export default async function HistoryPage() {
    let records: RunningRecord[] = [];
    let fetchError = "";

    try {
        records = await getRunningHistoryServer();
    } catch (e) {
        fetchError =
            e instanceof Error ? e.message : "기록을 불러올 수 없습니다.";
    }

    const totalDist = records.reduce((s, r) => s + r.distance_km, 0);
    const totalDays = new Set(records.map((r) => r.created_at.slice(0, 10)))
        .size;
    const avgPace =
        records.length > 0
            ? records.reduce((s, r) => s + r.pace, 0) / records.length
            : 0;
    const currentStreak = calcCurrentStreak(records);

    const DEFAULT_WEIGHT_KG = 70;
    const totalCalories = records.reduce(
        (s, r) => s + calcCaloriesByPace(r.pace, r.activity_type, DEFAULT_WEIGHT_KG, r.duration_seconds),
        0,
    );

    const runRecords = records.filter((r) => r.activity_type === "running");
    const walkRecords = records.filter((r) => r.activity_type === "walking");
    const runDist = runRecords.reduce((s, r) => s + r.distance_km, 0);
    const walkDist = walkRecords.reduce((s, r) => s + r.distance_km, 0);
    const runAvgPace = runRecords.length > 0 ? runRecords.reduce((s, r) => s + r.pace, 0) / runRecords.length : 0;
    const walkAvgPace = walkRecords.length > 0 ? walkRecords.reduce((s, r) => s + r.pace, 0) / walkRecords.length : 0;
    const allBadges = deriveAllBadges(records);

    return (
        <main className="min-h-dvh" style={{background: "var(--c-bg)"}}>
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
                        className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                        style={{
                            background: "var(--c-elevated)",
                            border: "1px solid var(--c-border)",
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            style={{color: "var(--c-text-1)"}}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </Link>
                </div>

                <h1
                    className="mb-2"
                    style={{
                        fontSize: 26,
                        fontWeight: 800,
                        color: "var(--c-text-1)",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                    }}
                >
                    활동 기록
                </h1>
                <p style={{fontSize: 15, color: "var(--c-text-2)"}}>
                    총 {records.length}회
                </p>
            </div>

            {/* 요약 카드 */}
            {records.length > 0 && (
                <>
                <div className="px-4 pt-4">
                    <div className="card rounded-2xl p-4">
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
                            전체 요약
                        </p>
                        <div className="grid grid-cols-4 gap-0">
                            <SummaryNum
                                value={totalDist.toFixed(1)}
                                unit="km"
                                label="총 거리"
                            />
                            <SummaryNum
                                value={String(records.length)}
                                unit="회"
                                label="활동"
                            />
                            <SummaryNum
                                value={String(totalDays)}
                                unit="일"
                                label="활동일"
                            />
                            <SummaryNum
                                value={String(currentStreak)}
                                unit="일"
                                label="연속"
                            />
                        </div>
                        <div
                            className="grid mt-3 pt-3"
                            style={{
                                borderTop: "1px solid var(--c-border)",
                                gridTemplateColumns: avgPace > 0 ? "1fr 1fr" : "1fr",
                                gap: 8,
                            }}
                        >
                            {avgPace > 0 && (
                                <div className="flex justify-between items-center">
                                    <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>평균 페이스</span>
                                    <span className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>
                                        {formatPace(avgPace)}{" "}
                                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)" }}>/km</span>
                                    </span>
                                </div>
                            )}
                            {totalCalories > 0 && (
                                <div className="flex justify-between items-center">
                                    <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>총 칼로리</span>
                                    <span className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-1)" }}>
                                        {totalCalories.toLocaleString()}{" "}
                                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)" }}>kcal</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 활동 유형별 분석 */}
                {runRecords.length > 0 && walkRecords.length > 0 && (
                    <div className="px-4 pt-3">
                        <div className="card rounded-2xl p-4">
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
                                유형별 분석
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <ActivityTypeCard
                                    label="러닝"
                                    accent="var(--c-toss-blue)"
                                    count={runRecords.length}
                                    distKm={runDist}
                                    avgPace={runAvgPace}
                                />
                                <ActivityTypeCard
                                    label="워킹"
                                    accent="var(--c-walk)"
                                    count={walkRecords.length}
                                    distKm={walkDist}
                                    avgPace={walkAvgPace}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <PaceTrendChart records={records} />

                {allBadges.length > 0 && (
                    <div className="px-4 pt-3">
                        <div className="card rounded-2xl p-4">
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
                                획득한 배지
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {allBadges.map((badge) => (
                                    <div
                                        key={badge.key}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                        style={{
                                            background: "var(--c-elevated)",
                                            border: "1px solid var(--c-border)",
                                        }}
                                    >
                                        <span style={{fontSize: 20}}>{badge.icon}</span>
                                        <div>
                                            <p style={{fontSize: 12, fontWeight: 600, color: "var(--c-text-1)", lineHeight: 1.2}}>{badge.title}</p>
                                            <p style={{fontSize: 10, color: "var(--c-text-3)", marginTop: 1}}>{badge.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                </>
            )}

            {/* 주간 차트 */}
            {records.length > 0 && <WeeklyChart records={records} />}

            {/* 리스트 */}
            <div className="px-4 pt-3 pb-8 space-y-2">
                {fetchError && (
                    <div
                        className="mt-4 rounded-2xl p-4 text-sm"
                        style={{
                            background: "var(--c-surface)",
                            border: "1px solid var(--c-border)",
                            color: "var(--c-danger)",
                        }}
                    >
                        {fetchError}
                    </div>
                )}

                {!fetchError && records.length === 0 && (
                    <div className="flex flex-col items-center justify-center mt-20 gap-4">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center"
                            style={{
                                background: "var(--c-surface)",
                                border: "1px solid var(--c-border)",
                            }}
                        >
                            <svg
                                width="28"
                                height="28"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                style={{color: "var(--c-text-3)"}}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p
                                className="font-semibold mb-1"
                                style={{color: "var(--c-text-1)"}}
                            >
                                아직 기록이 없습니다
                            </p>
                            <p style={{fontSize: 14, color: "var(--c-text-2)"}}>
                                첫 활동을 시작해보세요
                            </p>
                        </div>
                        <Link
                            href="/"
                            className="mt-2 px-6 py-3 rounded-2xl text-sm font-bold text-white"
                            style={{
                                background: "var(--c-toss-blue)",
                                boxShadow: "0 4px 16px var(--c-toss-blue)44",
                            }}
                        >
                            활동 시작하기
                        </Link>
                    </div>
                )}

                {records.map((r, i) => (
                    <RecordCard key={r.id} record={r} rank={i + 1} />
                ))}
            </div>
        </main>
    );
}

function SummaryNum({
    value,
    unit,
    label,
}: {
    value: string;
    unit: string;
    label: string;
}) {
    return (
        <div className="text-center">
            <div className="flex items-baseline justify-center gap-0.5">
                <span
                    className="num"
                    style={{
                        fontSize: 26,
                        fontWeight: 800,
                        color: "var(--c-text-1)",
                        letterSpacing: "-0.03em",
                    }}
                >
                    {value}
                </span>
                <span
                    style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--c-text-2)",
                    }}
                >
                    {unit}
                </span>
            </div>
            <p style={{fontSize: 11, color: "var(--c-text-3)", marginTop: 2}}>
                {label}
            </p>
        </div>
    );
}

function ActivityTypeCard({
    label,
    accent,
    count,
    distKm,
    avgPace,
}: {
    label: string;
    accent: string;
    count: number;
    distKm: number;
    avgPace: number;
}) {
    return (
        <div
            className="rounded-xl p-3"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}
        >
            <div className="flex items-center gap-1.5 mb-2">
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)" }}>{label}</span>
            </div>
            <div className="space-y-1">
                <div className="flex justify-between">
                    <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>거리</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-1)" }}>{distKm.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                    <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>횟수</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-1)" }}>{count}회</span>
                </div>
                {avgPace > 0 && (
                    <div className="flex justify-between">
                        <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>평균 페이스</span>
                        <span className="num" style={{ fontSize: 13, fontWeight: 700, color: accent }}>{formatPace(avgPace)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function RecordCard({record, rank}: {record: RunningRecord; rank: number}) {
    const isRun = record.activity_type === "running";
    const accent = isRun ? "var(--c-toss-blue)" : "var(--c-walk)";
    const hasGapAdjustment = (record.gap_adjustment_distance_km ?? 0) > 0;
    const isAutoGapMode = record.gap_adjustment_auto_enabled ?? false;
    const gapDistance = record.gap_adjustment_distance_km ?? 0;
    const date = new Date(record.created_at);

    const dateStr = formatDateShort(date);
    const timeStr = formatTime(date);
    const memo = (record.memo ?? "").trim();

    return (
        <div className="card rounded-2xl transition-all active:scale-[0.99]">
            {/* 헤더 행 */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <div className="flex items-center gap-3">
                    <span
                        className="num"
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--c-text-3)",
                            minWidth: 20,
                        }}
                    >
                        {rank}
                    </span>
                    <div>
                        <p
                            style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: "var(--c-text-1)",
                                lineHeight: 1.2,
                            }}
                        >
                            {dateStr}
                        </p>
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--c-text-3)",
                                marginTop: 1,
                            }}
                        >
                            {timeStr}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{background: `${accent}18`, color: accent}}
                    >
                        {isRun ? "러닝" : "워킹"}
                    </span>
                    {hasGapAdjustment && (
                        <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{
                                background: isAutoGapMode
                                    ? "rgba(0,122,255,0.12)"
                                    : "rgba(255,159,10,0.15)",
                                color: isAutoGapMode
                                    ? "var(--c-toss-blue)"
                                    : "#ff9f0a",
                                border: `1px solid ${isAutoGapMode ? "rgba(0,122,255,0.28)" : "rgba(255,159,10,0.35)"}`,
                                boxShadow: isAutoGapMode
                                    ? "0 0 0 1px rgba(0,122,255,0.08)"
                                    : "0 0 0 1px rgba(255,159,10,0.12)",
                            }}
                            title={`공백 보정 거리 +${gapDistance.toFixed(2)}km`}
                        >
                            {isAutoGapMode ? "자동 보정" : "수동 보정"} +
                            {gapDistance.toFixed(2)}km
                        </span>
                    )}
                </div>
                <DeleteRecordButton id={record.id} />
            </div>

            {/* 스탯 행 */}
            <div
                className="grid grid-cols-3 px-4 pb-3.5 pt-2"
                style={{borderTop: "1px solid var(--c-border)"}}
            >
                {[
                    {
                        label: "거리",
                        value: record.distance_km.toFixed(2),
                        unit: "km",
                    },
                    {
                        label: "시간",
                        value: formatDuration(record.duration_seconds),
                        unit: "",
                    },
                    {
                        label: "페이스",
                        value: formatPace(record.pace),
                        unit: "/km",
                    },
                ].map(({label, value, unit}) => (
                    <div key={label} className="text-center">
                        <p
                            style={{
                                fontSize: 11,
                                color: "var(--c-text-3)",
                                marginBottom: 2,
                            }}
                        >
                            {label}
                        </p>
                        <div className="flex items-baseline justify-center gap-0.5">
                            <span
                                className="num"
                                style={{
                                    fontSize: 17,
                                    fontWeight: 700,
                                    color: accent,
                                }}
                            >
                                {value}
                            </span>
                            {unit && (
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: "var(--c-text-3)",
                                    }}
                                >
                                    {unit}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <EditableMemo id={record.id} initialMemo={memo} />
        </div>
    );
}
