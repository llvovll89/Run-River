"use client";

export function SheetHandle() {
    return (
        <div className="flex justify-center mb-5">
            <div
                className="w-10 h-1 rounded-full"
                style={{ background: "var(--c-text-3)", opacity: 0.5 }}
            />
        </div>
    );
}

export function SheetActionGrid({
    secondaryLabel,
    onSecondary,
    primaryLabel,
    onPrimary,
    primaryColor,
}: {
    secondaryLabel: string;
    onSecondary: () => void;
    primaryLabel: string;
    onPrimary: () => void;
    primaryColor: string;
    /** 그림자 없이 면 색으로만 강조한다. 기존 호출 호환용 */
    primaryShadow?: string;
}) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <button
                type="button"
                onClick={onSecondary}
                className="min-h-14 rounded-2xl font-bold text-[17px] active:scale-[0.98] transition-transform"
                style={{
                    background: "var(--c-surface)",
                    color: "var(--c-text-1)",
                    border: "1px solid var(--c-border)",
                    letterSpacing: "-0.01em",
                }}
            >
                {secondaryLabel}
            </button>
            <button
                type="button"
                onClick={onPrimary}
                className="min-h-14 rounded-2xl font-bold text-[17px] active:scale-[0.98] transition-transform"
                style={{
                    background: primaryColor,
                    color: "var(--c-on-accent)",
                    letterSpacing: "-0.01em",
                }}
            >
                {primaryLabel}
            </button>
        </div>
    );
}
