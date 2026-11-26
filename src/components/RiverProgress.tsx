import type {ReactNode} from "react";

// 브랜드 로고의 굽이치는 강줄기를 가로로 펼친 선. 흐른 만큼(ratio) 짙은 물길로 채운다.
const RIVER_PATH = "M2 10 C 34 2, 62 18, 100 10 S 166 2, 200 10 S 266 18, 298 10";

export function RiverProgress({label, value, ratio}: {label: ReactNode; value: ReactNode; ratio: number}) {
    const filled = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
    return <div className="river-progress">
        <div className="river-progress-label"><span>{label}</span><strong className="num">{value}</strong></div>
        <svg viewBox="0 0 300 20" preserveAspectRatio="none" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(filled * 100)} aria-label={typeof label === "string" ? label : undefined}>
            <path className="river-track" d={RIVER_PATH} fill="none" strokeWidth="4" strokeLinecap="round" />
            <path className="river-flow" d={RIVER_PATH} fill="none" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 - filled * 100} />
        </svg>
    </div>;
}
