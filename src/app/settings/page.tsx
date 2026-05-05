"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { UserProfile } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, saveProfile } = useUserProfile();

  const [weight, setWeight] = useState(String(profile.weight));
  const [height, setHeight] = useState(String(profile.height));
  const [age, setAge] = useState(String(profile.age));
  const [weeklyGoal, setWeeklyGoal] = useState(String(profile.weeklyGoalKm));
  const [autoPause, setAutoPause] = useState(profile.autoPause ?? true);
  const [error, setError] = useState("");

  function handleSave() {
    const w = Number(weight);
    const h = Number(height);
    const a = Number(age);
    const g = Number(weeklyGoal);

    if (!w || w < 20 || w > 300) { setError("체중은 20~300kg 사이로 입력해주세요."); return; }
    if (!h || h < 100 || h > 250) { setError("키는 100~250cm 사이로 입력해주세요."); return; }
    if (!a || a < 1 || a > 120) { setError("나이는 1~120세 사이로 입력해주세요."); return; }
    if (!g || g < 1 || g > 500) { setError("주간 목표는 1~500km 사이로 입력해주세요."); return; }

    const p: UserProfile = { weight: w, height: h, age: a, weeklyGoalKm: g, autoPause };
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
            className="relative flex-shrink-0"
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
