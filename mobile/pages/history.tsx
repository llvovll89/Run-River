"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import HistoryView from "@/components/HistoryView";
import {getCurrentUser, getRunningHistory} from "@/lib/supabase";
import {useUserProfile} from "@/hooks/useUserProfile";
import type {RunningRecord} from "@/types";
import HistoryLoading from "@/app/history/loading";

const connectionDelayMessage = "연결이 지연되고 있어요. 인터넷 연결을 확인한 뒤 통계를 다시 열어주세요.";

async function withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(connectionDelayMessage)), 10000);
            }),
        ]);
    } catch (error) {
        // Auth can time out acquiring its browser lock before our request timer.
        if (error && typeof error === "object" && "isAcquireTimeout" in error && error.isAcquireTimeout) {
            throw new Error(connectionDelayMessage);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

export default function MobileHistoryPage() {
    const {profile} = useUserProfile();
    const [records, setRecords] = useState<RunningRecord[]>([]);
    const [fetchError, setFetchError] = useState("");
    const [loading, setLoading] = useState(true);
    const requestRef = useRef(0);

    const load = useCallback(async () => {
        const request = ++requestRef.current;
        try {
            setFetchError("");
            const user = await withTimeout(getCurrentUser());
            if (request !== requestRef.current) return;
            if (!user) {
                window.location.replace("/auth/?next=%2Fhistory%2F");
                return;
            }
            const nextRecords = await withTimeout(getRunningHistory());
            if (request === requestRef.current) setRecords(nextRecords);
        } catch (error) {
            if (request === requestRef.current) {
                setRecords([]);
                setFetchError(error instanceof Error ? error.message : "기록을 불러올 수 없습니다.");
            }
        } finally {
            if (request === requestRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        const reload = () => void load();
        window.addEventListener("run-record-deleted", reload);
        window.addEventListener("online", reload);
        return () => {
            requestRef.current += 1;
            window.removeEventListener("run-record-deleted", reload);
            window.removeEventListener("online", reload);
        };
    }, [load]);

    if (loading) return <HistoryLoading />;
    return <HistoryView records={records} fetchError={fetchError} weightKg={profile.weight} />;
}
