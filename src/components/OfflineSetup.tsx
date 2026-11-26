"use client";

import {createContext, useContext, useEffect, useState} from "react";
import {readActiveRun} from "@/lib/runStorage";

const OfflineStatusContext = createContext("");

export default function OfflineSetup({children}: {children: React.ReactNode}) {
    const [status, setStatus] = useState("");
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_NATIVE_APP === "1") {
            setStatus("앱 화면은 기기에 저장돼요 · 지도는 미리 저장해주세요");
            return;
        }
        if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
        let disposed = false;
        const update = (message: string) => { if (!disposed) setStatus(message); };
        update("오프라인 실행 준비 중…");
        navigator.serviceWorker.register("/sw.js", {updateViaCache: "none"})
            .then(async () => {
                await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise((_, reject) => setTimeout(() => reject(new Error("offline setup timeout")), 30000)),
                ]);
                const keys = (await caches.keys()).filter((key) => key.startsWith("run-river-offline-"));
                const prepared = await Promise.all(keys.map(async (key) => Boolean(await (await caches.open(key)).match("/running"))));
                if (!prepared.some(Boolean)) throw new Error("offline cache unavailable");
                update("오프라인 실행 준비 완료 · 화면을 켜두면 GPS 기록이 계속돼요");
            })
            .catch(() => update("오프라인 준비 실패 · 연결 후 다시 열어주세요"));
        return () => { disposed = true; };
    }, []);
    return <OfflineStatusContext.Provider value={status}>
        {children}
        <span className="sr-only" role="status" data-testid="offline-setup">{status}</span>
    </OfflineStatusContext.Provider>;
}

export function OfflineStatus() {
    const [active, setActive] = useState(false);
    useEffect(() => {try {setActive(Boolean(readActiveRun()));} catch {}}, []);
    return <div className="home-offline-status">
        {active && <a href="/running">진행 중인 운동 복구</a>}
        <a href="/maps">오프라인 지도 준비</a>
        <a href="/hiking">하이킹 시작</a>
    </div>;
}

/** 오프라인 준비 상태. 출발 전에 바로 확인할 수 있게 홈 시트 푸터에 한 줄로 둔다. */
export function OfflineStatusText() {
    const status = useContext(OfflineStatusContext);
    const ready = status.includes("준비 완료");
    return <p className="offline-status-text" data-ready={ready || undefined}>
        {ready ? "오프라인 기록 준비 완료" : status || "화면을 켜두고 운동해주세요"}
    </p>;
}

/** 빌드 버전. 업데이트 여부 확인용이라 홈 시트를 펼쳤을 때만 보인다. */
export function AppVersion() {
    if (!process.env.NEXT_PUBLIC_APP_VERSION) return null;
    return <p className="app-version">버전 {process.env.NEXT_PUBLIC_APP_VERSION}</p>;
}
