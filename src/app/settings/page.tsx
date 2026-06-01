"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {useUserProfile} from "@/hooks/useUserProfile";
import {useOfflineSync} from "@/hooks/useOfflineSync";
import {
    dequeue,
    getExhaustedQueue,
    resetAllExhaustedRetries,
    resetRetry,
    type PendingRecord,
} from "@/lib/offlineQueue";
import {
    claimLegacyRecords,
    getUnclaimedLegacyCount,
    signOut,
} from "@/lib/supabase";
import {DEFAULT_RUN_TUNING, normalizeRunTuning} from "@/lib/runTuning";
import type {UserProfile} from "@/types";

function formatRetryTime(ts: number | null): string {
    if (!ts) return "-";
    const diffSec = Math.max(0, Math.round((ts - Date.now()) / 1000));
    if (diffSec <= 0) return "지금";
    if (diffSec < 60) return `${diffSec}초 후`;
    return `${Math.round(diffSec / 60)}분 후`;
}

export default function SettingsPage() {
    const router = useRouter();
    const {profile, saveProfile, syncState, syncErrorMessage, retrySync} =
        useUserProfile();
    const {
        pendingCount,
        blockedCount,
        exhaustedCount,
        syncing,
        nextRetryAt,
        syncNow,
    } = useOfflineSync();

    const [weight, setWeight] = useState(String(profile.weight));
    const [height, setHeight] = useState(String(profile.height));
    const [age, setAge] = useState(String(profile.age));
    const [weeklyGoal, setWeeklyGoal] = useState(String(profile.weeklyGoalKm));
    const [autoPause, setAutoPause] = useState(profile.autoPause ?? true);
    const [autoApplyGapAdjustment, setAutoApplyGapAdjustment] = useState(
        profile.autoApplyGapAdjustment ?? false,
    );
    const [exhaustedItems, setExhaustedItems] = useState<PendingRecord[]>([]);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [bulkRetryInfo, setBulkRetryInfo] = useState<{
        running: boolean;
        total: number;
        prepared: number;
        message: string;
    }>({running: false, total: 0, prepared: 0, message: ""});
    const [isOnline, setIsOnline] = useState(() =>
        typeof navigator !== "undefined" ? navigator.onLine : true,
    );
    const [unclaimedCount, setUnclaimedCount] = useState(0);
    const [claiming, setClaiming] = useState(false);
    const [claimMessage, setClaimMessage] = useState("");
    const [error, setError] = useState("");
    const [autoPauseStopSpeed, setAutoPauseStopSpeed] = useState("0.45");
    const [autoPauseResumeSpeed, setAutoPauseResumeSpeed] = useState("0.90");
    const [autoPauseStillnessSec, setAutoPauseStillnessSec] = useState("4.5");
    const [autoPauseMinMoveMeters, setAutoPauseMinMoveMeters] = useState("0.3");
    const [offRouteThresholdMeters, setOffRouteThresholdMeters] = useState("60");
    const [offRouteSustainSec, setOffRouteSustainSec] = useState("10");
    const [offRouteAlertCooldownSec, setOffRouteAlertCooldownSec] = useState("90");

    const applyTuningInputs = (source: typeof DEFAULT_RUN_TUNING) => {
        setAutoPauseStopSpeed(source.autoPauseStopSpeedMs.toFixed(2));
        setAutoPauseResumeSpeed(source.autoPauseResumeSpeedMs.toFixed(2));
        setAutoPauseStillnessSec((source.autoPauseStillnessMs / 1000).toFixed(1));
        setAutoPauseMinMoveMeters((source.autoPauseMinMoveKm * 1000).toFixed(1));
        setOffRouteThresholdMeters((source.offRouteThresholdKm * 1000).toFixed(0));
        setOffRouteSustainSec((source.offRouteSustainMs / 1000).toFixed(0));
        setOffRouteAlertCooldownSec((source.offRouteAlertCooldownMs / 1000).toFixed(0));
    };

    useEffect(() => {
        setExhaustedItems(getExhaustedQueue());
    }, [pendingCount, exhaustedCount, syncing]);

    useEffect(() => {
        setWeight(String(profile.weight));
        setHeight(String(profile.height));
        setAge(String(profile.age));
        setWeeklyGoal(String(profile.weeklyGoalKm));
        setAutoPause(profile.autoPause ?? true);
        setAutoApplyGapAdjustment(profile.autoApplyGapAdjustment ?? false);
        applyTuningInputs(
            normalizeRunTuning(profile.runTuning ?? DEFAULT_RUN_TUNING),
        );
    }, [profile]);

    useEffect(() => {
        let mounted = true;

        async function loadUnclaimedCount() {
            try {
                const count = await getUnclaimedLegacyCount();
                if (mounted) setUnclaimedCount(count);
            } catch {
                if (mounted) setUnclaimedCount(0);
            }
        }

        void loadUnclaimedCount();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    async function handleRetryExhausted(id: string) {
        resetRetry(id);
        setExhaustedItems(getExhaustedQueue());
        try {
            await syncNow(true);
            setSyncError(null);
        } catch {
            setSyncError("동기화 재시도 중 오류가 발생했습니다.");
        }
    }

    async function handleRetryAllExhausted() {
        const total = exhaustedItems.length;
        setBulkRetryInfo({
            running: true,
            total,
            prepared: 0,
            message: "재시도 큐 준비 중...",
        });

        const updated = resetAllExhaustedRetries();
        setExhaustedItems(getExhaustedQueue());
        if (updated === 0) {
            setBulkRetryInfo({
                running: false,
                total: 0,
                prepared: 0,
                message: "재시도할 항목이 없습니다.",
            });
            return;
        }

        setBulkRetryInfo({
            running: true,
            total,
            prepared: updated,
            message: "서버 동기화 진행 중...",
        });

        try {
            await syncNow(true);
            setSyncError(null);
            const remaining = getExhaustedQueue().length;
            const processed = Math.max(0, updated - remaining);
            setBulkRetryInfo({
                running: false,
                total,
                prepared: updated,
                message: `전체 재시도 완료 · 성공 ${processed}건, 잔여 ${remaining}건`,
            });
        } catch {
            setSyncError("전체 재시도 중 오류가 발생했습니다.");
            setBulkRetryInfo({
                running: false,
                total,
                prepared: updated,
                message: "전체 재시도 중 오류가 발생했습니다.",
            });
        }
    }

    function handleDeleteExhausted(id: string) {
        dequeue(id);
        setExhaustedItems(getExhaustedQueue());
    }

    async function handleClaimLegacyRecords() {
        if (claiming) return;
        setClaiming(true);
        setClaimMessage("");

        try {
            const claimed = await claimLegacyRecords(500);
            const count = await getUnclaimedLegacyCount();
            setUnclaimedCount(count);
            setClaimMessage(
                claimed > 0
                    ? `${claimed}건의 기존 기록을 내 계정으로 가져왔습니다.`
                    : "가져올 기존 기록이 없습니다.",
            );
            if (claimed > 0) {
                await syncNow(true);
            }
        } catch {
            setClaimMessage(
                "기존 기록 가져오기에 실패했습니다. 잠시 후 다시 시도해주세요.",
            );
        } finally {
            setClaiming(false);
        }
    }

    async function handleSignOut() {
        try {
            await signOut();
            window.location.href = "/auth";
        } catch {
            setError("로그아웃에 실패했습니다.");
        }
    }

    function handleSave() {
        const w = Number(weight);
        const h = Number(height);
        const a = Number(age);
        const g = Number(weeklyGoal);
        const stopSpeed = Number(autoPauseStopSpeed);
        const resumeSpeed = Number(autoPauseResumeSpeed);
        const stillnessSec = Number(autoPauseStillnessSec);
        const minMoveMeters = Number(autoPauseMinMoveMeters);
        const routeThresholdMeters = Number(offRouteThresholdMeters);
        const routeSustainSec = Number(offRouteSustainSec);
        const routeCooldownSec = Number(offRouteAlertCooldownSec);

        if (!w || w < 20 || w > 300) {
            setError("체중은 20~300kg 사이로 입력해주세요.");
            return;
        }
        if (!h || h < 100 || h > 250) {
            setError("키는 100~250cm 사이로 입력해주세요.");
            return;
        }
        if (!a || a < 1 || a > 120) {
            setError("나이는 1~120세 사이로 입력해주세요.");
            return;
        }
        if (!g || g < 1 || g > 500) {
            setError("주간 목표는 1~500km 사이로 입력해주세요.");
            return;
        }
        if (!stopSpeed || stopSpeed < 0.2 || stopSpeed > 1.2) {
            setError("자동 정지 속도는 0.2~1.2m/s 사이로 입력해주세요.");
            return;
        }
        if (!resumeSpeed || resumeSpeed < 0.3 || resumeSpeed > 2.0) {
            setError("자동 재개 속도는 0.3~2.0m/s 사이로 입력해주세요.");
            return;
        }
        if (!stillnessSec || stillnessSec < 2 || stillnessSec > 12) {
            setError("정지 판정 시간은 2~12초 사이로 입력해주세요.");
            return;
        }
        if (!minMoveMeters || minMoveMeters < 0.1 || minMoveMeters > 2) {
            setError("이동 감지 거리는 0.1~2.0m 사이로 입력해주세요.");
            return;
        }
        if (!routeThresholdMeters || routeThresholdMeters < 20 || routeThresholdMeters > 200) {
            setError("경로 이탈 감지 거리는 20~200m 사이로 입력해주세요.");
            return;
        }
        if (!routeSustainSec || routeSustainSec < 3 || routeSustainSec > 30) {
            setError("이탈 지속 시간은 3~30초 사이로 입력해주세요.");
            return;
        }
        if (!routeCooldownSec || routeCooldownSec < 10 || routeCooldownSec > 300) {
            setError("이탈 알림 간격은 10~300초 사이로 입력해주세요.");
            return;
        }

        const p: UserProfile = {
            weight: w,
            height: h,
            age: a,
            weeklyGoalKm: g,
            autoPause,
            autoApplyGapAdjustment,
            runTuning: normalizeRunTuning({
                autoPauseStopSpeedMs: stopSpeed,
                autoPauseResumeSpeedMs: resumeSpeed,
                autoPauseStillnessMs: Math.round(stillnessSec * 1000),
                autoPauseMinMoveKm: minMoveMeters / 1000,
                offRouteThresholdKm: routeThresholdMeters / 1000,
                offRouteSustainMs: Math.round(routeSustainSec * 1000),
                offRouteAlertCooldownMs: Math.round(routeCooldownSec * 1000),
            }),
        };
        saveProfile(p);
        router.back();
    }

    function handleResetRunTuningDefaults() {
        applyTuningInputs(DEFAULT_RUN_TUNING);
        setError("");
    }

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
                    <button
                        onClick={() => router.back()}
                        className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                        style={{
                            background: "var(--c-elevated)",
                            border: "1px solid var(--c-border)",
                        }}
                        aria-label="뒤로 가기"
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
                    </button>
                </div>
                <h1
                    className="font-bold"
                    style={{
                        fontSize: 24,
                        letterSpacing: "-0.02em",
                        color: "var(--c-text-1)",
                    }}
                >
                    내 프로필
                </h1>
                <div className="mt-2 flex items-center gap-2">
                    <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block"
                        style={{
                            background:
                                syncState === "saving"
                                    ? "rgba(0,122,255,0.15)"
                                    : syncState === "synced"
                                      ? "rgba(52,199,89,0.15)"
                                      : syncState === "error"
                                        ? "rgba(255,69,58,0.15)"
                                        : "var(--c-elevated)",
                            color:
                                syncState === "saving"
                                    ? "var(--c-toss-blue)"
                                    : syncState === "synced"
                                      ? "var(--c-walk)"
                                      : syncState === "error"
                                        ? "var(--c-danger)"
                                        : "var(--c-text-3)",
                            border: "1px solid var(--c-border)",
                        }}
                    >
                        {syncState === "saving"
                            ? "클라우드 저장 중..."
                            : syncState === "synced"
                              ? "클라우드 반영됨"
                              : syncState === "error"
                                ? "로컬 저장됨 · 클라우드 재시도 필요"
                                : "로컬/클라우드 동기화 대기"}
                    </span>
                    {syncState === "error" && (
                        <button
                            onClick={() => void retrySync()}
                            className="h-11 px-3 rounded-full text-xs font-semibold active:scale-95 transition-transform"
                            style={{
                                background: "rgba(0,122,255,0.14)",
                                color: "var(--c-toss-blue)",
                                border: "1px solid rgba(0,122,255,0.35)",
                            }}
                        >
                            지금 재시도
                        </button>
                    )}
                </div>
                {syncState === "error" && syncErrorMessage && (
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--c-danger)",
                            marginTop: 6,
                        }}
                    >
                        최근 오류: {syncErrorMessage}
                    </p>
                )}
                <p
                    style={{
                        fontSize: 13,
                        color: "var(--c-text-3)",
                        marginTop: 4,
                    }}
                >
                    칼로리·걸음 수 계산에 사용됩니다
                </p>
            </div>

            {/* 폼 */}
            <div className="px-5 py-6 flex flex-col gap-4">
                <div
                    className="rounded-2xl p-4"
                    style={{
                        background: "var(--c-surface)",
                        border: "1px solid var(--c-border)",
                    }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p
                                style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: "var(--c-text-1)",
                                }}
                            >
                                레거시 기록 가져오기
                            </p>
                            <p
                                style={{
                                    fontSize: 12,
                                    color: "var(--c-text-3)",
                                    marginTop: 4,
                                }}
                            >
                                user_id가 없는 기존 기록 {unclaimedCount}건
                            </p>
                        </div>
                        <button
                            onClick={() => void handleClaimLegacyRecords()}
                            disabled={claiming || unclaimedCount <= 0}
                            className="h-11 px-3 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
                            style={{
                                background:
                                    claiming || unclaimedCount <= 0
                                        ? "var(--c-elevated)"
                                        : "var(--c-toss-blue)",
                                color:
                                    claiming || unclaimedCount <= 0
                                        ? "var(--c-text-3)"
                                        : "#fff",
                                border: "1px solid var(--c-border)",
                            }}
                        >
                            {claiming ? "처리 중..." : "내 기록으로 가져오기"}
                        </button>
                    </div>
                    {claimMessage && (
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--c-text-2)",
                                marginTop: 8,
                            }}
                        >
                            {claimMessage}
                        </p>
                    )}
                </div>

                <ProfileField
                    label="체중"
                    unit="kg"
                    value={weight}
                    onChange={setWeight}
                    placeholder="70"
                />
                <ProfileField
                    label="키"
                    unit="cm"
                    value={height}
                    onChange={setHeight}
                    placeholder="170"
                />
                <ProfileField
                    label="나이"
                    unit="세"
                    value={age}
                    onChange={setAge}
                    placeholder="30"
                />
                <ProfileField
                    label="주간 목표"
                    unit="km"
                    value={weeklyGoal}
                    onChange={setWeeklyGoal}
                    placeholder="20"
                />

                <div
                    className="flex items-center justify-between px-4 py-4 rounded-2xl"
                    style={{
                        background: "var(--c-surface)",
                        border: "1px solid var(--c-border)",
                    }}
                >
                    <div>
                        <span
                            className="font-semibold"
                            style={{fontSize: 15, color: "var(--c-text-1)"}}
                        >
                            자동 일시정지
                        </span>
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--c-text-3)",
                                marginTop: 2,
                            }}
                        >
                            3초 이상 정지 시 자동으로 일시정지
                        </p>
                    </div>
                    <button
                        onClick={() => setAutoPause((v) => !v)}
                        className="relative shrink-0"
                        style={{
                            width: 51,
                            height: 31,
                            borderRadius: 16,
                            background: autoPause
                                ? "var(--c-toss-blue)"
                                : "var(--c-elevated)",
                            border: "1px solid var(--c-border)",
                            transition: "background 0.2s",
                        }}
                        aria-label="자동 일시정지 토글"
                    >
                        <span
                            style={{
                                position: "absolute",
                                top: 3,
                                left: autoPause ? 23 : 3,
                                width: 23,
                                height: 23,
                                borderRadius: "50%",
                                background: "#fff",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                                transition: "left 0.2s",
                            }}
                        />
                    </button>
                </div>

                <div
                    className="flex items-center justify-between px-4 py-4 rounded-2xl"
                    style={{
                        background: "var(--c-surface)",
                        border: "1px solid var(--c-border)",
                    }}
                >
                    <div>
                        <span
                            className="font-semibold"
                            style={{fontSize: 15, color: "var(--c-text-1)"}}
                        >
                            공백 구간 자동 보정
                        </span>
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--c-text-3)",
                                marginTop: 2,
                            }}
                        >
                            복귀 시 추천 거리를 자동으로 반영
                        </p>
                    </div>
                    <button
                        onClick={() => setAutoApplyGapAdjustment((v) => !v)}
                        className="relative shrink-0"
                        style={{
                            width: 51,
                            height: 31,
                            borderRadius: 16,
                            background: autoApplyGapAdjustment
                                ? "var(--c-toss-blue)"
                                : "var(--c-elevated)",
                            border: "1px solid var(--c-border)",
                            transition: "background 0.2s",
                        }}
                        aria-label="공백 구간 자동 보정 토글"
                    >
                        <span
                            style={{
                                position: "absolute",
                                top: 3,
                                left: autoApplyGapAdjustment ? 23 : 3,
                                width: 23,
                                height: 23,
                                borderRadius: "50%",
                                background: "#fff",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                                transition: "left 0.2s",
                            }}
                        />
                    </button>
                </div>

                <div
                    className="rounded-2xl p-4"
                    style={{
                        background: "var(--c-surface)",
                        border: "1px solid var(--c-border)",
                    }}
                >
                    <div className="flex items-center justify-between gap-2">
                        <p
                            className="font-semibold"
                            style={{fontSize: 15, color: "var(--c-text-1)"}}
                        >
                            러닝 정밀 설정
                        </p>
                        <button
                            onClick={handleResetRunTuningDefaults}
                            className="h-11 px-3 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
                            style={{
                                background: "var(--c-elevated)",
                                color: "var(--c-text-2)",
                                border: "1px solid var(--c-border)",
                            }}
                        >
                            기본값으로 되돌리기
                        </button>
                    </div>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--c-text-3)",
                            marginTop: 4,
                            marginBottom: 10,
                        }}
                    >
                        자동 일시정지/경로 이탈 감지 민감도를 조정합니다.
                    </p>

                    <div className="flex flex-col gap-2">
                        <ProfileField
                            label="자동 정지 속도"
                            unit="m/s"
                            value={autoPauseStopSpeed}
                            onChange={setAutoPauseStopSpeed}
                            placeholder="0.45"
                        />
                        <ProfileField
                            label="자동 재개 속도"
                            unit="m/s"
                            value={autoPauseResumeSpeed}
                            onChange={setAutoPauseResumeSpeed}
                            placeholder="0.90"
                        />
                        <ProfileField
                            label="정지 판정 시간"
                            unit="초"
                            value={autoPauseStillnessSec}
                            onChange={setAutoPauseStillnessSec}
                            placeholder="4.5"
                        />
                        <ProfileField
                            label="이동 감지 거리"
                            unit="m"
                            value={autoPauseMinMoveMeters}
                            onChange={setAutoPauseMinMoveMeters}
                            placeholder="0.3"
                        />
                        <ProfileField
                            label="경로 이탈 감지"
                            unit="m"
                            value={offRouteThresholdMeters}
                            onChange={setOffRouteThresholdMeters}
                            placeholder="60"
                        />
                        <ProfileField
                            label="이탈 지속 시간"
                            unit="초"
                            value={offRouteSustainSec}
                            onChange={setOffRouteSustainSec}
                            placeholder="10"
                        />
                        <ProfileField
                            label="이탈 알림 간격"
                            unit="초"
                            value={offRouteAlertCooldownSec}
                            onChange={setOffRouteAlertCooldownSec}
                            placeholder="90"
                        />
                    </div>
                </div>

                <div
                    className="px-4 py-4 rounded-2xl"
                    style={{
                        background: "var(--c-surface)",
                        border: "1px solid var(--c-border)",
                    }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span
                            className="font-semibold"
                            style={{fontSize: 15, color: "var(--c-text-1)"}}
                        >
                            오프라인 동기화
                        </span>
                        <span style={{fontSize: 12, color: "var(--c-text-3)"}}>
                            대기 {pendingCount}건
                        </span>
                    </div>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--c-text-3)",
                            marginBottom: 10,
                        }}
                    >
                        실패 누적 {exhaustedCount}건은 수동 재시도 또는 삭제할
                        수 있어요.
                        {blockedCount > 0
                            ? ` 자동 재시도 ${formatRetryTime(nextRetryAt)} (${blockedCount}건)`
                            : ""}
                    </p>
                    {!isOnline && (
                        <p
                            style={{
                                fontSize: 12,
                                color: "#ff9f0a",
                                marginBottom: 10,
                            }}
                        >
                            오프라인 상태에서는 동기화가 대기됩니다.
                        </p>
                    )}
                    <button
                        onClick={() =>
                            void syncNow(exhaustedCount > 0)
                        }
                        className="h-11 px-3 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                        style={{
                            background: syncing
                                ? "var(--c-elevated)"
                                : exhaustedCount > 0
                                  ? "rgba(255,159,10,0.12)"
                                  : "var(--c-toss-blue)",
                            color: syncing
                                ? "var(--c-text-3)"
                                : exhaustedCount > 0
                                  ? "#ff9f0a"
                                  : "#fff",
                            border:
                                exhaustedCount > 0
                                    ? "1px solid rgba(255,159,10,0.3)"
                                    : "1px solid var(--c-border)",
                        }}
                        disabled={syncing || !isOnline}
                    >
                        {syncing
                            ? "동기화 중..."
                            : exhaustedCount > 0
                              ? "강제 동기화"
                              : "지금 동기화"}
                    </button>

                    {exhaustedCount > 0 && (
                        <button
                            onClick={() => void syncNow(true)}
                            className="ml-2 h-11 px-3 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                            style={{
                                background: "rgba(255,159,10,0.12)",
                                color: "#ff9f0a",
                                border: "1px solid rgba(255,159,10,0.3)",
                            }}
                            disabled={syncing || !isOnline}
                        >
                            강제 동기화
                        </button>
                    )}

                    {exhaustedItems.length > 1 && (
                        <button
                            onClick={() => void handleRetryAllExhausted()}
                            className="ml-2 h-11 px-3 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                            style={{
                                background: "rgba(0,122,255,0.12)",
                                color: "var(--c-toss-blue)",
                                border: "1px solid rgba(0,122,255,0.3)",
                            }}
                            disabled={syncing || !isOnline}
                        >
                            실패 전체 재시도
                        </button>
                    )}

                    {syncError && (
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--c-danger)",
                                marginTop: 8,
                            }}
                        >
                            {syncError}
                        </p>
                    )}

                    {(bulkRetryInfo.running || bulkRetryInfo.message) && (
                        <div
                            className="mt-2 rounded-xl px-3 py-2"
                            style={{
                                background: "var(--c-elevated)",
                                border: "1px solid var(--c-border)",
                            }}
                        >
                            <p style={{fontSize: 12, color: "var(--c-text-2)"}}>
                                {bulkRetryInfo.running
                                    ? "실행 중"
                                    : "실행 결과"}
                                {bulkRetryInfo.total > 0
                                    ? ` · 대상 ${bulkRetryInfo.total}건`
                                    : ""}
                                {bulkRetryInfo.prepared > 0
                                    ? ` · 준비 ${bulkRetryInfo.prepared}건`
                                    : ""}
                            </p>
                            <p
                                style={{
                                    fontSize: 12,
                                    color: "var(--c-text-3)",
                                    marginTop: 2,
                                }}
                            >
                                {bulkRetryInfo.message}
                            </p>
                        </div>
                    )}

                    {exhaustedItems.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2">
                            {exhaustedItems.map((item) => (
                                <div
                                    key={item.queueId}
                                    className="rounded-xl px-3 py-3"
                                    style={{
                                        background: "var(--c-elevated)",
                                        border: "1px solid var(--c-border)",
                                    }}
                                >
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: "var(--c-text-2)",
                                        }}
                                    >
                                        {item.record.activity_type === "running"
                                            ? "러닝"
                                            : "워킹"}{" "}
                                        · {item.record.distance_km.toFixed(2)}km
                                    </p>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--c-text-3)",
                                            marginTop: 2,
                                        }}
                                    >
                                        실패 {item.retryCount}회 ·{" "}
                                        {item.lastError ?? "알 수 없는 오류"}
                                    </p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <button
                                            onClick={() =>
                                                void handleRetryExhausted(
                                                    item.queueId,
                                                )
                                            }
                                            className="h-11 px-3 rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                                            style={{
                                                background:
                                                    "rgba(0,122,255,0.12)",
                                                color: "var(--c-toss-blue)",
                                                border: "1px solid rgba(0,122,255,0.3)",
                                            }}
                                        >
                                            재시도
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleDeleteExhausted(
                                                    item.queueId,
                                                )
                                            }
                                            className="h-11 px-3 rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                                            style={{
                                                background:
                                                    "rgba(255,69,58,0.12)",
                                                color: "var(--c-danger)",
                                                border: "1px solid rgba(255,69,58,0.3)",
                                            }}
                                        >
                                            삭제
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {error && (
                    <p style={{fontSize: 13, color: "var(--c-danger)"}}>
                        {error}
                    </p>
                )}

                <button
                    onClick={handleSave}
                    className="w-full py-4 rounded-2xl font-bold text-base text-white active:scale-[0.98] transition-transform"
                    style={{
                        background: "var(--c-toss-blue)",
                        boxShadow: "0 4px 20px rgba(0,122,255,0.35)",
                        letterSpacing: "-0.01em",
                        marginTop: 8,
                    }}
                >
                    저장
                </button>

                <button
                    onClick={() => void handleSignOut()}
                    className="w-full py-3.5 rounded-2xl font-semibold text-sm"
                    style={{
                        background: "var(--c-elevated)",
                        color: "var(--c-danger)",
                        border: "1px solid var(--c-border)",
                    }}
                >
                    로그아웃
                </button>
            </div>
        </main>
    );
}

function ProfileField({
    label,
    unit,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    unit: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
}) {
    return (
        <div
            className="flex items-center justify-between px-4 py-4 rounded-2xl"
            style={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
            }}
        >
            <span
                className="font-semibold"
                style={{fontSize: 15, color: "var(--c-text-1)"}}
            >
                {label}
            </span>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="text-right font-bold outline-none bg-transparent"
                    style={{
                        fontSize: 18,
                        width: 72,
                        color: "var(--c-text-1)",
                        caretColor: "var(--c-toss-blue)",
                    }}
                />
                <span style={{fontSize: 13, color: "var(--c-text-3)"}}>
                    {unit}
                </span>
            </div>
        </div>
    );
}
