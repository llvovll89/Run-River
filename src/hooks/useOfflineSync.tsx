"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    dequeue,
    getQueue,
    getQueueSummary,
    markRetry,
    resetRetry,
    resetAllExhaustedRetries,
    RETRY_EXHAUSTED_AT,
} from "@/lib/offlineQueue";

async function getSupabaseSyncApi() {
    return import("@/lib/supabase");
}

interface OfflineSyncContextValue {
    pendingCount: number;
    blockedCount: number;
    exhaustedCount: number;
    syncing: boolean;
    lastSyncedAt: number | null;
    lastError: string | null;
    nextRetryAt: number | null;
    syncNow: (force?: boolean) => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({children}: {children: React.ReactNode}) {
    const [pendingCount, setPendingCount] = useState(0);
    const [blockedCount, setBlockedCount] = useState(0);
    const [exhaustedCount, setExhaustedCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);
    const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
    const syncInFlightRef = useRef(false);

    const refreshSummary = useCallback(() => {
        const summary = getQueueSummary();
        setPendingCount(summary.pendingCount);
        setBlockedCount(summary.blockedCount);
        setExhaustedCount(summary.exhaustedCount);
        setNextRetryAt(summary.nextRetryAt);
    }, []);

    const syncNow = useCallback(async (force = false) => {
        if (syncInFlightRef.current || !navigator.onLine) {
            refreshSummary();
            return;
        }

        syncInFlightRef.current = true;
        setSyncing(true);
        let succeeded = false;
        let latestError: string | null = null;

        try {
            const {saveRunningRecord} = await getSupabaseSyncApi();
            const now = Date.now();

            if (force) {
                resetAllExhaustedRetries();
            }

            const queue = getQueue();

            for (const item of queue) {
                if (!force) {
                    if (item.nextRetryAt === RETRY_EXHAUSTED_AT) continue;
                    if (item.nextRetryAt > now) continue;
                }

                try {
                    await saveRunningRecord(item.record);
                    resetRetry(item.queueId);
                    dequeue(item.queueId);
                    succeeded = true;
                } catch (e) {
                    latestError =
                        e instanceof Error ? e.message : "동기화 실패";
                    markRetry(item.queueId, latestError);
                    // 한 건 실패해도 나머지 가능한 항목은 계속 동기화한다.
                    continue;
                }
            }
        } finally {
            if (succeeded) setLastSyncedAt(Date.now());
            setLastError(latestError);
            refreshSummary();
            setSyncing(false);
            syncInFlightRef.current = false;
        }
    }, [refreshSummary]);

    useEffect(() => {
        const onOnline = () => {
            void syncNow();
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") void syncNow();
        };

        refreshSummary();
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisible);

        const timer = window.setInterval(() => {
            if (navigator.onLine) void syncNow();
            else refreshSummary();
        }, 15000);

        if (navigator.onLine) void syncNow();

        return () => {
            window.removeEventListener("online", onOnline);
            document.removeEventListener("visibilitychange", onVisible);
            window.clearInterval(timer);
        };
    }, [refreshSummary, syncNow]);

    const value = useMemo<OfflineSyncContextValue>(
        () => ({
            pendingCount,
            blockedCount,
            exhaustedCount,
            syncing,
            lastSyncedAt,
            lastError,
            nextRetryAt,
            syncNow,
        }),
        [
            pendingCount,
            blockedCount,
            exhaustedCount,
            syncing,
            lastSyncedAt,
            lastError,
            nextRetryAt,
            syncNow,
        ],
    );

    return (
        <OfflineSyncContext.Provider value={value}>
            {children}
        </OfflineSyncContext.Provider>
    );
}

export function useOfflineSync() {
    const context = useContext(OfflineSyncContext);
    if (!context) {
        throw new Error(
            "useOfflineSync must be used within OfflineSyncProvider",
        );
    }
    return context;
}
