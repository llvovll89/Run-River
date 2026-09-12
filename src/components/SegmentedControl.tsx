"use client";

import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
    value: T;
    label: ReactNode;
    color: string;
}

export default function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    gapClassName = "gap-1",
    itemPaddingClassName = "py-2",
    shadowBlur = 10,
    wrapperExtraClassName = "",
}: {
    options: SegmentedOption<T>[];
    value: T;
    onChange: (v: T) => void;
    gapClassName?: string;
    itemPaddingClassName?: string;
    shadowBlur?: number;
    wrapperExtraClassName?: string;
}) {
    return (
        <div
            className={`flex ${gapClassName} p-1 rounded-2xl ${wrapperExtraClassName}`}
            style={{ background: "var(--c-elevated)" }}
        >
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`flex-1 flex items-center justify-center gap-2 ${itemPaddingClassName} rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]`}
                        style={{
                            background: active ? opt.color : "transparent",
                            color: active ? "#fff" : "var(--c-text-2)",
                            boxShadow: active
                                ? `0 2px ${shadowBlur}px ${opt.color}44`
                                : "none",
                        }}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
