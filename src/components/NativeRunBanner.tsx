"use client";

import {useEffect, useState} from "react";
import {NativeRun, hasNativeRun} from "@/lib/nativeRun";

export default function NativeRunBanner() {
    const [active, setActive] = useState(false);
    useEffect(() => {
        if (!hasNativeRun()) return;
        const check = () => { void NativeRun.snapshot().then(({run}) => setActive(Boolean(run))).catch(() => {}); };
        check(); window.addEventListener("focus", check);
        return () => window.removeEventListener("focus", check);
    }, []);
    return active ? <a href="/running/" className="resume-record block" style={{position: "fixed", zIndex: 90, top: "calc(var(--sat) + 76px)", left: "50%", transform: "translateX(-50%)", width: "calc(100% - 40px)", maxWidth: 390, background: "var(--c-surface)", boxShadow: "0 4px 18px rgba(18,61,70,.15)"}}><strong>기기에 저장된 운동으로 돌아가기</strong><span>위치 기록 상태를 확인하고 이어서 운동해요.</span></a> : null;
}
