"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatPace } from "@/lib/utils";

interface Stats {
  totalKm: number;
  totalRuns: number;
  avgPace: number;
}

const APP_URL = "https://run-river.vercel.app/";

const FEATURES = [
  { icon: "📍", text: "GPS 실시간 위치 추적" },
  { icon: "⚡", text: "페이스 & 구간 실시간 분석" },
  { icon: "🗺️", text: "경로 지도 자동 기록" },
  { icon: "🏃", text: "러닝 / 워킹 활동 구분" },
  { icon: "📊", text: "누적 통계 & 주간 차트" },
];

const BROWSERS = [
  {
    name: "Safari (iOS)",
    color: "#007aff",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#007aff" strokeWidth="1.8"/>
        <path d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12" stroke="#007aff" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M8.5 8.5 L15.5 15.5 M15.5 8.5 L12 12" stroke="#007aff" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    steps: [
      "하단 공유 버튼(□↑) 탭",
      "\"홈 화면에 추가\" 선택",
      "\"추가\" 탭",
    ],
  },
  {
    name: "Chrome (Android)",
    color: "#34a853",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#34a853" strokeWidth="1.8"/>
        <circle cx="12" cy="12" r="4" stroke="#4285f4" strokeWidth="1.8"/>
        <path d="M12 8 L21 12 M12 8 L3 12" stroke="#ea4335" strokeWidth="1.8"/>
        <path d="M7.5 15.5 L12 8" stroke="#fbbc04" strokeWidth="1.8"/>
      </svg>
    ),
    steps: [
      "우측 상단 메뉴(⋮) 탭",
      "\"앱 설치\" 또는 \"홈 화면에 추가\" 선택",
      "\"설치\" 탭",
    ],
  },
  {
    name: "Samsung Internet",
    color: "#4b9cf5",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="#4b9cf5" strokeWidth="1.8"/>
        <path d="M8 12 Q12 7 16 12 Q12 17 8 12Z" fill="#4b9cf5"/>
      </svg>
    ),
    steps: [
      "하단 메뉴(≡) 탭",
      "\"페이지 추가\" → \"홈 화면\" 선택",
      "\"추가\" 탭",
    ],
  },
  {
    name: "Edge (Mobile)",
    color: "#0078d4",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M21 8C21 5.2 18.8 3 16 3 C10 3 5 8 5 14 C5 18.4 8.6 22 13 22 C16 22 19 20.2 20.5 17.5" stroke="#0078d4" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M3 14 C3 14 6 10 12 10 C16.4 10 19 12 19 12" stroke="#0078d4" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    steps: [
      "하단 메뉴(···) 탭",
      "\"휴대폰에 추가\" 선택",
      "\"홈 화면에 추가\" 탭",
    ],
  },
  {
    name: "Firefox (Android)",
    color: "#ff7139",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#ff7139" strokeWidth="1.8"/>
        <path d="M12 3 C8 3 5 6 5 10 C5 14 8 17 12 17 C16 17 19 14 19 10" stroke="#ff7139" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M12 17 C12 17 14 15 14 12 C14 9 12 8 12 8" stroke="#ff7139" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    steps: [
      "우측 상단 메뉴(⋮) 탭",
      "\"설치\" 선택",
      "\"추가\" 탭",
    ],
  },
];

function InstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden"
        style={{ background: "#161719", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>앱으로 설치하기</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>브라우저별 설치 방법을 확인하세요</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* 브라우저 목록 */}
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {BROWSERS.map(({ name, color, icon, steps }) => (
            <div
              key={name}
              className="rounded-2xl px-4 py-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* 브라우저명 */}
              <div className="flex items-center gap-2.5 mb-3">
                {icon}
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{name}</span>
              </div>

              {/* 스텝 */}
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: `${color}22`, fontSize: 11, fontWeight: 700, color }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, paddingTop: 2 }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {/* 하단 닫기 */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-opacity hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PCLanding() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=12&color=ffffff&bgcolor=1a1c1f&data=${encodeURIComponent(APP_URL)}`;

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    supabase
      .from("running_records")
      .select("distance_km, pace")
      .then(({ data }) => {
        if (!data?.length) return;
        setStats({
          totalKm: data.reduce((s, r) => s + r.distance_km, 0),
          totalRuns: data.length,
          avgPace: data.reduce((s, r) => s + r.pace, 0) / data.length,
        });
      });
  }, []);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!showInstallModal) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") setShowInstallModal(false); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [showInstallModal]);

  return (
    <>
      {showInstallModal && <InstallModal onClose={() => setShowInstallModal(false)} />}

      <div
        className="fixed inset-0 flex flex-col overflow-y-auto"
        style={{ background: "#0a0b0c", color: "#fff" }}
      >
        {/* 상단 네비 */}
        <div
          className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "var(--c-toss-blue)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Run River</span>
          </div>
          <Link
            href="/history"
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            기록 보기
          </Link>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 md:px-8 py-8 md:py-12">
          <div className="w-full max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

              {/* 왼쪽 */}
              <div>
                <span
                  className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-5"
                  style={{ background: "rgba(0,122,255,0.15)", color: "var(--c-toss-blue)", letterSpacing: "0.04em" }}
                >
                  GPS 러닝 트래커
                </span>
                <h1
                  className="mb-3"
                  style={{ fontSize: "clamp(28px, 4.5vw, 52px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}
                >
                  Run River
                </h1>
                <p style={{ fontSize: "clamp(14px, 1.4vw, 17px)", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 28 }}>
                  스마트폰으로 달리고, 걷고, 기록하세요.
                  <br />실시간 GPS로 경로와 페이스를 추적합니다.
                </p>

                {/* 기능 리스트 */}
                <ul className="space-y-2.5 mb-8">
                  {FEATURES.map(({ icon, text }) => (
                    <li key={text} className="flex items-center gap-3">
                      <span style={{ fontSize: 17 }}>{icon}</span>
                      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.65)" }}>{text}</span>
                    </li>
                  ))}
                </ul>

                {/* 통계 */}
                {stats && (
                  <div
                    className="rounded-2xl p-4 grid grid-cols-3 gap-4 mb-8"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div className="text-center">
                      <p className="num" style={{ fontSize: 22, fontWeight: 800, color: "var(--c-toss-blue)", letterSpacing: "-0.03em" }}>
                        {stats.totalKm.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>km</span>
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>총 거리</p>
                    </div>
                    <div className="text-center" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="num" style={{ fontSize: 22, fontWeight: 800, color: "var(--c-toss-blue)", letterSpacing: "-0.03em" }}>
                        {stats.totalRuns}<span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>회</span>
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>활동 횟수</p>
                    </div>
                    <div className="text-center">
                      <p className="num" style={{ fontSize: 22, fontWeight: 800, color: "var(--c-toss-blue)", letterSpacing: "-0.03em" }}>
                        {formatPace(stats.avgPace)}<span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>/km</span>
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>평균 페이스</p>
                    </div>
                  </div>
                )}

                {/* 앱 설치 버튼 */}
                <button
                  onClick={() => setShowInstallModal(true)}
                  className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    background: "rgba(0,122,255,0.12)",
                    border: "1px solid rgba(0,122,255,0.3)",
                    color: "var(--c-toss-blue)",
                    fontSize: 14,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 3v13M7 11l5 5 5-5"/>
                    <path d="M5 21h14"/>
                  </svg>
                  앱으로 설치하는 방법
                </button>
              </div>

              {/* 오른쪽: QR */}
              <div className="flex flex-col items-center lg:items-center">
                <div
                  className="rounded-3xl p-6 mb-5 w-full max-w-xs"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p
                    className="text-center mb-4"
                    style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}
                  >
                    SCAN TO OPEN
                  </p>
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrSrc}
                      alt="QR Code"
                      width={200}
                      height={200}
                      className="rounded-2xl"
                      style={{ display: "block" }}
                    />
                  </div>
                  <p
                    className="text-center mt-4 font-mono"
                    style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}
                  >
                    {APP_URL}
                  </p>
                </div>

                <p className="text-center mb-6" style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
                  스마트폰 카메라로 QR을 스캔하면
                  <br />바로 앱을 시작할 수 있습니다
                </p>

                <Link
                  href="/history"
                  className="w-full max-w-xs py-3.5 rounded-2xl text-sm font-bold text-center block transition-opacity hover:opacity-80"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  기록 보기 →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 */}
        <div
          className="px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-0 justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.18)" }}>
            PC에서는 기록 조회만 가능합니다 · 실제 활동은 모바일에서 이용해주세요
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.18)" }}>Run River</p>
        </div>
      </div>
    </>
  );
}
