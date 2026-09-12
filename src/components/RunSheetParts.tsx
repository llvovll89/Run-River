"use client";

export function SheetHandle() {
    return (
        <div className="flex justify-center mb-5">
            <div
                className="w-10 h-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.2)" }}
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
    primaryShadow,
}: {
    secondaryLabel: string;
    onSecondary: () => void;
    primaryLabel: string;
    onPrimary: () => void;
    primaryColor: string;
    primaryShadow: string;
}) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <button
                onClick={onSecondary}
                className="py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
                style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "#d1d4d9",
                    border: "1px solid rgba(255,255,255,0.12)",
                    letterSpacing: "-0.01em",
                }}
            >
                {secondaryLabel}
            </button>
            <button
                onClick={onPrimary}
                className="py-4 rounded-2xl font-bold text-base text-white active:scale-[0.98] transition-transform"
                style={{
                    background: primaryColor,
                    boxShadow: primaryShadow,
                    letterSpacing: "-0.01em",
                }}
            >
                {primaryLabel}
            </button>
        </div>
    );
}
