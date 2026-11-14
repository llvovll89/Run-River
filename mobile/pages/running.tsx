"use client";

import {useEffect, useState} from "react";
import {hasNativeRun} from "@/lib/nativeRun";
import NativeRunScreen from "@/components/NativeRunScreen";
import WebRunningPage from "@/components/WebRunningPage";

export default function MobileRunningPage() {
    const [native, setNative] = useState<boolean | null>(null);
    useEffect(() => setNative(hasNativeRun()), []);
    if (native === null) return <p role="status">운동 기록 준비 중…</p>;
    return native ? <NativeRunScreen /> : <WebRunningPage />;
}
