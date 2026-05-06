"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { dequeue, getExhaustedQueue, resetAllExhaustedRetries, resetRetry, type PendingRecord } from "@/lib/offlineQueue";
import type { UserProfile } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, saveProfile } = useUserProfile();
  const { pendingCount, exhaustedCount, syncing, syncNow } = useOfflineSync();

  const [weight, setWeight] = useState(String(profile.weight));
  const [height, setHeight] = useState(String(profile.height));
  const [age, setAge] = useState(String(profile.age));
  const [weeklyGoal, setWeeklyGoal] = useState(String(profile.weeklyGoalKm));
  const [autoPause, setAutoPause] = useState(profile.autoPause ?? true);
  const [autoApplyGapAdjustment, setAutoApplyGapAdjustment] = useState(profile.autoApplyGapAdjustment ?? false);
  const [exhaustedItems, setExhaustedItems] = useState<PendingRecord[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [bulkRetryInfo, setBulkRetryInfo] = useState<{
    running: boolean;
    total: number;
    prepared: number;
    message: string;
  }>({ running: false, total: 0, prepared: 0, message: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    setExhaustedItems(getExhaustedQueue());
  }, [pendingCount, exhaustedCount, syncing]);

  async function handleRetryExhausted(id: string) {
    resetRetry(id);
    setExhaustedItems(getExhaustedQueue());
    try {
      await syncNow();
      setSyncError(null);
    } catch {
      setSyncError("동기화 재시도 중 오류가 발생했습니다.");
    }
  }

  async function handleRetryAllExhausted() {
    const total = exhaustedItems.length;
    setBulkRetryInfo({ running: true, total, prepared: 0, message: "재시도 큐 준비 중..." });

    const updated = resetAllExhaustedRetries();
    setExhaustedItems(getExhaustedQueue());
    if (updated === 0) {
      setBulkRetryInfo({ running: false, total: 0, prepared: 0, message: "재시도할 항목이 없습니다." });
      return;
    }

    setBulkRetryInfo({ running: true, total, prepared: updated, message: "서버 동기화 진행 중..." });

    try {
      await syncNow();
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
      setBulkRetryInfo({ running: false, total, prepared: updated, message: "전체 재시도 중 오류가 발생했습니다." });
    }
  }

  function handleDeleteExhausted(id: string) {
    dequeue(id);
    setExhaustedItems(getExhaustedQueue());
  }

  function handleSave() {
    const w = Number(weight);
    const h = Number(height);
    const a = Number(age);
    const g = Number(weeklyGoal);

    if (!w || w < 20 || w > 300) { setError("체중은 20~300kg 사이로 입력해주세요."); return; }
    if (!h || h < 100 || h > 250) { setError("키는 100~250cm 사이로 입력해주세요."); return; }
    if (!a || a < 1 || a > 120) { setError("나이는 1~120세 사이로 입력해주세요."); return; }
    if (!g || g < 1 || g > 500) { setError("주간 목표는 1~500km 사이로 입력해주세요."); return; }

    const p: UserProfile = {
      weight: w,
      height: h,
      age: a,
      weeklyGoalKm: g,
      autoPause,
      autoApplyGapAdjustment,
    };
    saveProfile(p);
    router.back();
  }

  return (
    <main className="min-h-dvh" style={{ background: "var(--c-bg)" }}>
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
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}
            aria-label="뒤로 가기"
          >
            <svg width="16" height="16" style={{ color: "var(--c-text-1)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <h1
          className="font-bold"
          style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--c-text-1)" }}
        >
          내 프로필
        </h1>
        <p style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 4 }}>
          칼로리·걸음 수 계산에 사용됩니다
        </p>
      </div>

      {/* 폼 */}
      <div className="px-5 py-6 flex flex-col gap-4">
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
          style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
        >
          <div>
            <span className="font-semibold" style={{ fontSize: 15, color: "var(--c-text-1)" }}>자동 일시정지</span>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2 }}>3초 이상 정지 시 자동으로 일시정지</p>
          </div>
          <button
            onClick={() => setAutoPause((v) => !v)}
            className="relative shrink-0"
            style={{
              width: 51,
              height: 31,
              borderRadius: 16,
              background: autoPause ? "var(--c-toss-blue)" : "var(--c-elevated)",
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
          style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
        >
          <div>
            <span className="font-semibold" style={{ fontSize: 15, color: "var(--c-text-1)" }}>공백 구간 자동 보정</span>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2 }}>복귀 시 추천 거리를 자동으로 반영</p>
          </div>
          <button
            onClick={() => setAutoApplyGapAdjustment((v) => !v)}
            className="relative shrink-0"
            style={{
              width: 51,
              height: 31,
              borderRadius: 16,
              background: autoApplyGapAdjustment ? "var(--c-toss-blue)" : "var(--c-elevated)",
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
          className="px-4 py-4 rounded-2xl"
          style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold" style={{ fontSize: 15, color: "var(--c-text-1)" }}>오프라인 동기화</span>
            <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>대기 {pendingCount}건</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 10 }}>
            실패 누적 {exhaustedCount}건은 수동 재시도 또는 삭제할 수 있어요.
          </p>
          <button
            onClick={() => void syncNow()}
            className="px-3 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
            style={{
              background: syncing ? "var(--c-elevated)" : "var(--c-toss-blue)",
              color: syncing ? "var(--c-text-3)" : "#fff",
              border: "1px solid var(--c-border)",
            }}
            disabled={syncing}
          >
            {syncing ? "동기화 중..." : "지금 동기화"}
          </button>

          {exhaustedItems.length > 1 && (
            <button
              onClick={() => void handleRetryAllExhausted()}
              className="ml-2 px-3 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
              style={{
                background: "rgba(0,122,255,0.12)",
                color: "var(--c-toss-blue)",
                border: "1px solid rgba(0,122,255,0.3)",
              }}
              disabled={syncing}
            >
              실패 전체 재시도
            </button>
          )}

          {syncError && (
            <p style={{ fontSize: 12, color: "var(--c-danger)", marginTop: 8 }}>{syncError}</p>
          )}

          {(bulkRetryInfo.running || bulkRetryInfo.message) && (
            <div className="mt-2 rounded-xl px-3 py-2" style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
              <p style={{ fontSize: 12, color: "var(--c-text-2)" }}>
                {bulkRetryInfo.running ? "실행 중" : "실행 결과"}
                {bulkRetryInfo.total > 0 ? ` · 대상 ${bulkRetryInfo.total}건` : ""}
                {bulkRetryInfo.prepared > 0 ? ` · 준비 ${bulkRetryInfo.prepared}건` : ""}
              </p>
              <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2 }}>
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
                  style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}
                >
                  <p style={{ fontSize: 12, color: "var(--c-text-2)" }}>
                    {item.record.activity_type === "running" ? "러닝" : "워킹"} · {item.record.distance_km.toFixed(2)}km
                  </p>
                  <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
                    실패 {item.retryCount}회 · {item.lastError ?? "알 수 없는 오류"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => void handleRetryExhausted(item.queueId)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                      style={{ background: "rgba(0,122,255,0.12)", color: "var(--c-toss-blue)", border: "1px solid rgba(0,122,255,0.3)" }}
                    >
                      재시도
                    </button>
                    <button
                      onClick={() => handleDeleteExhausted(item.queueId)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                      style={{ background: "rgba(255,69,58,0.12)", color: "var(--c-danger)", border: "1px solid rgba(255,69,58,0.3)" }}
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
          <p style={{ fontSize: 13, color: "var(--c-danger)" }}>{error}</p>
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
      style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
    >
      <span className="font-semibold" style={{ fontSize: 15, color: "var(--c-text-1)" }}>
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
        <span style={{ fontSize: 13, color: "var(--c-text-3)" }}>{unit}</span>
      </div>
    </div>
  );
}
