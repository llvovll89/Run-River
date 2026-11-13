import type {CSSProperties} from "react";

export function RiverMark({size = 28}: {size?: number}) {
    return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M7 3c17 3-9 10 7 14s12 8 4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M16 3c17 3-9 10 7 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".45" />
    </svg>;
}

export default function Brand({compact = false, style}: {compact?: boolean; style?: CSSProperties}) {
    return <span className="brand" style={style}><RiverMark />{!compact && <span>Run River</span>}</span>;
}
