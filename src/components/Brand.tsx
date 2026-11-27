import type {CSSProperties} from "react";

// Run River symbol: one GPS route drawing an italic R from an orange start point.
// 100-unit grid. Keep in sync with scripts/brand-icon.mjs and docs/brand/generate_brand.py.
const ROUTE = "M30 80 V33 A13 13 0 0 1 43 20 H55 A17 17 0 0 1 55 54 H50 L74 84";
const ROUTE_TRANSFORM = "translate(53.5 49.2) scale(.8) skewX(-8) translate(-52 -52)";

function BrandSymbol({route, dot}: {route: string; dot: string}) {
    return <>
        <path transform={ROUTE_TRANSFORM} d={ROUTE} fill="none" stroke={route} strokeWidth="12.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32.75" cy="71.6" r="8.8" fill={dot} />
    </>;
}

/** Bare symbol: the route follows the text color, the start point stays orange. */
export function RiverMark({size = 28}: {size?: number}) {
    return <svg width={size} height={size} viewBox="17 16.5 66 66" fill="none" aria-hidden="true" className="river-mark">
        <BrandSymbol route="currentColor" dot="var(--c-brand-accent)" />
    </svg>;
}

/** App icon tile, identical in both themes. */
export function BrandIcon({size = 28}: {size?: number}) {
    return <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="brand-icon">
        <rect width="100" height="100" rx="22.4" fill="#16294A" />
        <BrandSymbol route="#FFFFFF" dot="#F25C1F" />
    </svg>;
}

export default function Brand({compact = false, style}: {compact?: boolean; style?: CSSProperties}) {
    return <span className="brand" style={style}>
        <BrandIcon />
        {!compact && <span className="brand-wordmark" role="img" aria-label="Run River" />}
    </span>;
}
