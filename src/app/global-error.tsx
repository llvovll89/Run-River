"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영 이슈 추적을 위해 콘솔에 남긴다.
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "var(--c-bg)",
          color: "var(--c-text-1)",
          fontFamily: "Pretendard Variable, Pretendard, sans-serif",
          display: "grid",
          placeItems: "center",
          padding: "24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 430, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>앱을 복구하는 중입니다</h1>
          <p style={{ margin: "0 0 16px", color: "var(--c-text-2)", lineHeight: 1.5 }}>
            업데이트 직후 일시적인 오류가 발생할 수 있어요. 다시 시도하면 대부분 바로 복구됩니다.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                border: "none",
                borderRadius: 12,
                background: "var(--c-toss-blue)",
                color: "#fff",
                padding: "10px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
            <button
              onClick={() => window.location.replace(`${window.location.pathname}?retry=${Date.now()}`)}
              style={{
                border: "1px solid var(--c-border)",
                borderRadius: 12,
                background: "var(--c-surface)",
                color: "var(--c-text-1)",
                padding: "10px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              새로고침
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
