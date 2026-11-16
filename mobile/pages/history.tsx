"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import HistoryView from "@/components/HistoryView";
import {getCurrentUser, getRunningHistory} from "@/lib/supabase";
import {useUserProfile} from "@/hooks/useUserProfile";
import type {RunningRecord} from "@/types";
import HistoryLoading from "@/app/history/loading";
import {CONNECTION_DELAY_MESSAGE, withTimeout} from "@/lib/withTimeout";

const connectionDelayMessage = CONNECTION_DELAY_MESSAGE;

async function withConnectionTimeout<T>(operation: Promise<T>): Promise<T> {
    try {
        return await withTimeout(operation, 10000, connectionDelayMessage);
    } catch (error) {
        // Auth can time out acquiring its browser lock before our request timer.
        if (error && typeof error === "object" && "isAcquireTimeout" in error && error.isAcquireTimeout) {
            throw new Error(connectionDelayMessage);
        }
        throw error;
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
            const user = await withConnectionTimeout(getCurrentUser());
            if (request !== requestRef.current) return;
            if (!user) {
                window.location.replace("/auth/?next=%2Fhistory%2F");
                return;
            }
            const nextRecords = await withConnectionTimeout(getRunningHistory());
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
