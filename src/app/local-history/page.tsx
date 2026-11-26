"use client";

import {useEffect, useState} from "react";
import {readLocalResults, readActiveRun, type LocalResultEntry} from "@/lib/runStorage";
import {formatDuration} from "@/lib/utils";
import ScreenHeader from "@/components/ScreenHeader";
import AppNavigation from "@/components/AppNavigation";
import {RiverMark} from "@/components/Brand";
import {activityLabel, canSyncActivity} from "@/lib/activities";
import RouteThumbnail from "@/components/RouteThumbnail";

// 기록 제목을 "아침 러닝"처럼 하루 중 시간대로 구분한다.
function partOfDay(savedAt: number | string) {
    const hour = new Date(savedAt).getHours();
    if (hour < 5) return "새벽";
    if (hour < 11) return "아침";
    if (hour < 14) return "점심";
    if (hour < 18) return "오후";
    if (hour < 21) return "저녁";
    return "밤";
}

export default function LocalHistoryPage() {
    const [entries, setEntries] = useState<LocalResultEntry[]>([]);
    const [active, setActive] = useState(false);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<"all" | "running" | "walking" | "hiking">("all");
    useEffect(() => {
        const refresh = () => {
        try { setEntries(readLocalResults()); setActive(Boolean(readActiveRun())); }
        catch { setError("기기 기록을 읽지 못했어요. 저장된 데이터를 지우지 말고 저장 공간을 확인해주세요."); }
        };
        refresh();
        window.addEventListener("local-run-uploaded", refresh);
        return () => window.removeEventListener("local-run-uploaded", refresh);
    }, []);
    const visible = entries.filter(({result}) => filter === "all" || result.activity_type === filter);
    return <main className="app-screen min-h-dvh">
        <ScreenHeader title="기기 기록" description="이 휴대폰에 저장된 운동이에요. 인터넷 없이도 열어볼 수 있어요." />
        <section className="local-records" aria-label="운동 목록">
        {error && <p role="alert" className="py-4">{error}</p>}
        {active && <a href="/running" className="resume-record"><strong>진행 중인 운동 이어하기</strong><span>저장한 지점에서 기록을 복구할 수 있어요.</span></a>}
        {entries.length > 0 && <div className="flex gap-2 mb-2" role="group" aria-label="운동 종류 필터">
            {([['all', '전체'], ['running', '러닝'], ['walking', '걷기'], ['hiking', '하이킹']] as const).map(([value, label]) => <button className={`seg-btn ${filter === value ? "active" : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{label}</button>)}
        </div>}
        {!error && entries.length === 0 && <div className="empty-records"><RiverMark size={44} /><h2>아직 기록이 없어요</h2><p>운동을 마치면 지나온 길과 거리, 시간이 여기에 남아요.</p><a className="primary-link" href="/">운동 시작하기</a></div>}
        {entries.length > 0 && visible.length === 0 && <p className="py-10" style={{fontSize: 15, color: "var(--c-text-2)"}}>이 종류의 기록은 아직 없어요.</p>}
        {visible.map(({result, savedAt, uploaded}) => <a key={result.id} href={`/result?id=${result.id}`} className="record-row">
            <div className="record-date">{new Date(savedAt).getMonth() + 1}월<strong className="num">{new Date(savedAt).getDate()}</strong></div>
            <div className="record-main"><h2>{partOfDay(savedAt)} {activityLabel(result.activity_type)}</h2>
            <div className="record-metrics"><span><strong className="num">{result.distance_km.toFixed(2)}</strong> km</span><span className="num">{formatDuration(result.duration_seconds)}</span></div>
            <p className="record-save-state">{uploaded ? "서버 저장됨" : result.ownerId && canSyncActivity(result.activity_type) ? "기기 저장됨, 연결 후 업로드" : "이 기기에 저장됨"}</p></div>
            <RouteThumbnail points={result.pathPoints ?? []} />
            <span className="record-arrow" aria-hidden="true">›</span>
        </a>)}
        {entries.length > 0 && <p className="page-footnote" style={{paddingBottom: 8}}>브라우저 데이터를 지우면 기기 기록도 함께 지워져요. 오래 보관할 기록은 로그인해서 계정에 올려두세요.</p>}
        </section>
        <AppNavigation />
    </main>;
}
