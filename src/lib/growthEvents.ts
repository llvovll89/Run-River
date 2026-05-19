"use client";

type GrowthEventName =
    | "referral_visit"
    | "referral_banner_shown"
    | "referral_banner_start"
    | "referral_banner_dismiss"
    | "share_success"
    | "share_error";

interface GrowthEventPayload {
    [key: string]: string | number | boolean | null | undefined;
}

interface StoredGrowthEvent {
    name: GrowthEventName;
    at: number;
    payload?: GrowthEventPayload;
}

export interface GrowthSummary {
    counters: Record<GrowthEventName, number>;
    conversion: {
        referralToBannerRate: number;
        bannerToStartRate: number;
        shareSuccessRate: number;
    };
    byChallenge: Record<string, {visits: number; starts: number; shares: number}>;
    recent: StoredGrowthEvent[];
}

const STORAGE_KEY = "rr_growth_events";
const MAX_EVENTS = 100;
const EVENT_NAMES: GrowthEventName[] = [
    "referral_visit",
    "referral_banner_shown",
    "referral_banner_start",
    "referral_banner_dismiss",
    "share_success",
    "share_error",
];

export function trackGrowthEvent(
    name: GrowthEventName,
    payload?: GrowthEventPayload,
) {
    if (typeof window === "undefined") return;

    try {
        const currentRaw = localStorage.getItem(STORAGE_KEY);
        const current = currentRaw
            ? (JSON.parse(currentRaw) as StoredGrowthEvent[])
            : [];
        const next: StoredGrowthEvent[] = [
            ...current,
            {name, at: Date.now(), payload},
        ].slice(-MAX_EVENTS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

        const counterKey = `rr_growth_counter_${name}`;
        const prevCounter = Number(localStorage.getItem(counterKey) ?? "0");
        localStorage.setItem(counterKey, String(prevCounter + 1));

        if (process.env.NODE_ENV !== "production") {
            console.debug("[growth]", name, payload ?? {});
        }
    } catch {
        // 저장 실패는 기능 동작에 영향 주지 않음
    }
}

export function getGrowthSummary(): GrowthSummary {
    if (typeof window === "undefined") {
        return {
            counters: {
                referral_visit: 0,
                referral_banner_shown: 0,
                referral_banner_start: 0,
                referral_banner_dismiss: 0,
                share_success: 0,
                share_error: 0,
            },
            conversion: {
                referralToBannerRate: 0,
                bannerToStartRate: 0,
                shareSuccessRate: 0,
            },
            byChallenge: {},
            recent: [],
        };
    }

    const counters = EVENT_NAMES.reduce(
        (acc, eventName) => {
            const key = `rr_growth_counter_${eventName}`;
            acc[eventName] = Number(localStorage.getItem(key) ?? "0");
            return acc;
        },
        {
            referral_visit: 0,
            referral_banner_shown: 0,
            referral_banner_start: 0,
            referral_banner_dismiss: 0,
            share_success: 0,
            share_error: 0,
        } as Record<GrowthEventName, number>,
    );

    let recent: StoredGrowthEvent[] = [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        recent = raw ? (JSON.parse(raw) as StoredGrowthEvent[]) : [];
    } catch {
        recent = [];
    }

    const byChallenge: Record<string, {visits: number; starts: number; shares: number}> = {};
    for (const event of recent) {
        const rawChallenge = event.payload?.challenge;
        const challenge =
            typeof rawChallenge === "string" && rawChallenge.length > 0
                ? rawChallenge
                : "unknown";
        if (!byChallenge[challenge]) {
            byChallenge[challenge] = {visits: 0, starts: 0, shares: 0};
        }

        if (event.name === "referral_visit") byChallenge[challenge].visits += 1;
        if (event.name === "referral_banner_start") byChallenge[challenge].starts += 1;
        if (event.name === "share_success") byChallenge[challenge].shares += 1;
    }

    const referralToBannerRate =
        counters.referral_visit > 0
            ? counters.referral_banner_shown / counters.referral_visit
            : 0;
    const bannerToStartRate =
        counters.referral_banner_shown > 0
            ? counters.referral_banner_start / counters.referral_banner_shown
            : 0;
    const totalShareAttempts = counters.share_success + counters.share_error;
    const shareSuccessRate =
        totalShareAttempts > 0 ? counters.share_success / totalShareAttempts : 0;

    return {
        counters,
        conversion: {
            referralToBannerRate,
            bannerToStartRate,
            shareSuccessRate,
        },
        byChallenge,
        recent: recent.slice(-12).reverse(),
    };
}
