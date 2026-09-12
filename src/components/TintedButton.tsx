"use client";

import type { ReactNode } from "react";

type Tone = "accent" | "danger" | "danger-solid" | "neutral";

const TONE_STYLES: Record<Tone, { background: string; color: string; border: string }> = {
    accent: {
        background: "rgba(0,122,255,0.12)",
        color: "var(--c-toss-blue)",
        border: "1px solid rgba(0,122,255,0.3)",
    },
    danger: {
        background: "rgba(255,69,58,0.12)",
        color: "var(--c-danger)",
        border: "1px solid rgba(255,69,58,0.3)",
    },
    "danger-solid": {
        background: "var(--c-danger)",
        color: "#fff",
        border: "1px solid var(--c-danger)",
    },
    neutral: {
        background: "var(--c-elevated)",
        color: "var(--c-text-2)",
        border: "1px solid var(--c-border)",
    },
};

export default function TintedButton({
    tone,
    onClick,
    disabled,
    rounded = "xl",
    children,
}: {
    tone: Tone;
    onClick: () => void;
    disabled?: boolean;
    rounded?: "xl" | "full";
    children: ReactNode;
}) {
    const style = disabled
        ? { background: "var(--c-elevated)", color: "var(--c-text-3)", border: "1px solid var(--c-border)" }
        : TONE_STYLES[tone];
    const roundedClass = rounded === "full" ? "rounded-full" : "rounded-xl";

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`h-11 px-3 ${roundedClass} text-xs font-semibold active:scale-95 transition-transform`}
            style={style}
        >
            {children}
        </button>
    );
}
