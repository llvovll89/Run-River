"use client";

import type { ReactNode } from "react";

type Tone = "accent" | "danger" | "danger-solid" | "neutral";

// 색과 크기는 globals.css의 .btn[data-tone]에서 정한다.
export default function TintedButton({
    tone,
    onClick,
    disabled,
    rounded = "xl",
    wide = false,
    children,
}: {
    tone: Tone;
    onClick: () => void;
    disabled?: boolean;
    rounded?: "xl" | "full";
    wide?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            data-tone={tone}
            className={`btn${wide ? " btn-wide" : ""}${rounded === "full" ? " rounded-full" : ""}`}
        >
            {children}
        </button>
    );
}
