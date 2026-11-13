"use client";

import {useEffect, useState} from "react";
import {readLocalResults, readActiveRun, type LocalResultEntry} from "@/lib/runStorage";
import {formatDuration} from "@/lib/utils";

export default function LocalHistoryPage() {
    const [entries, setEntries] = useState<LocalResultEntry[]>([]);
    const [active, setActive] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        const refresh = () => {
        try { setEntries(readLocalResults()); setActive(Boolean(readActiveRun())); }
        catch { setError("기기 기록을 읽지 못했어요. 저장된 데이터를 지우지 말고 저장 공간을 확인해주세요."); }
        };
        refresh();
        window.addEventListener("local-run-uploaded", refresh);
        return () => window.removeEventListener("local-run-uploaded", refresh);
    }, []);
    return <main className="min-h-dvh p-5" style={{background: "var(--c-bg)", color: "var(--c-text-1)"}}>
        <a href="/" className="inline-block py-3">← 홈</a>
        <h1 className="text-2xl font-bold mb-3">이 기기의 운동 기록</h1>
        <p className="text-sm mb-5">경로는 이 기기에 보관돼요. 브라우저 데이터를 지우면 기록이 사라질 수 있어요.</p>
        {error && <p role="alert">{error}</p>}
        {active && <a href="/running" className="block p-4 mb-3 rounded-xl" style={{background: "var(--c-elevated)"}}>진행 중인 운동 이어하기 →</a>}
        {!error && entries.length === 0 && <p>아직 완료한 운동이 없어요.</p>}
        {entries.map(({result, savedAt, uploaded}) => <a key={result.id} href={`/result?id=${result.id}`} className="block p-4 mb-3 rounded-xl" style={{background: "var(--c-surface)", border: "1px solid var(--c-border)"}}>
            <p className="font-bold">{result.distance_km.toFixed(2)} km · {formatDuration(result.duration_seconds)}</p>
            <p className="text-xs mt-2">{new Date(savedAt).toLocaleString("ko-KR")} · {uploaded ? "서버 저장됨" : result.ownerId ? "기기 저장 · 같은 계정 연결 시 업로드" : "기기 저장 · 게스트"}</p>
        </a>)}
    </main>;
}
