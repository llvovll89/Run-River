"use client";

import type {RunningRecord} from "@/types";

export function ExportButton({records}: {records: RunningRecord[]}) {
    function handleExport() {
        if (records.length === 0) return;
        const header = "날짜,활동,거리(km),시간(초),페이스(분/km),메모\n";
        const rows = records
            .map((r) =>
                [
                    r.created_at.slice(0, 10),
                    r.activity_type === "running" ? "러닝" : "워킹",
                    r.distance_km.toFixed(2),
                    r.duration_seconds,
                    r.pace.toFixed(2),
                    // 메모 내 큰따옴표 이스케이프
                    `"${(r.memo ?? "").replace(/"/g, '""')}"`,
                ].join(","),
            )
            .join("\n");
        const blob = new Blob(["\uFEFF" + header + rows], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `run-river-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <button
            onClick={handleExport}
            disabled={records.length === 0}
            className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            style={{
                background: "var(--c-elevated)",
                border: "1px solid var(--c-border)",
                color:
                    records.length === 0
                        ? "var(--c-text-3)"
                        : "var(--c-text-1)",
            }}
            aria-label="CSV로 내보내기"
            title="CSV로 내보내기"
        >
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
        </button>
    );
}
