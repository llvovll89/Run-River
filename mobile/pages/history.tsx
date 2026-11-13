"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import HistoryView from "@/components/HistoryView";
import {getCurrentUser, getRunningHistory} from "@/lib/supabase";
import {useUserProfile} from "@/hooks/useUserProfile";
import type {RunningRecord} from "@/types";

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
            const user = await getCurrentUser();
            if (request !== requestRef.current) return;
            if (!user) {
                window.location.replace("/auth/?next=%2Fhistory%2F");
                return;
            }
            const nextRecords = await getRunningHistory();
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

    if (loading) return <p role="status" className="p-5">기록을 불러오는 중…</p>;
    return <HistoryView records={records} fetchError={fetchError} weightKg={profile.weight} />;
}
