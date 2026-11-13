"use client";

import {usePathname} from "next/navigation";
import {useEffect, useState, type MouseEvent} from "react";

const items = [
    {href: "/", label: "운동", path: "M6 20c0-7 12-7 12-14M7 5h.01M17 20h.01"},
    {href: "/local-history", label: "기기 기록", path: "M8 3h8l3 3v15H5V3h3m1 7h6m-6 4h6m-6 4h4"},
    {href: "/history", label: "통계", path: "M5 20V10m7 10V4m7 16v-7"},
    {href: "/settings", label: "설정", path: "M9 4h6l1 3 3 1v8l-3 1-1 3H9l-1-3-3-1V8l3-1 1-3m6 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0"},
];

const ONLINE_ONLY = ["/history", "/settings"];

export default function AppNavigation() {
    const pathname = usePathname();
    const [online, setOnline] = useState(true);
    const [notice, setNotice] = useState("");
    // 전체 페이지 이동은 홈 화면에 추가한 PWA에서 로딩 표시가 전혀 없어
    // 탭이 눌리지 않은 것처럼 보인다. 누른 탭에 즉시 이동 중 상태를 보여준다.
    const [pendingHref, setPendingHref] = useState<string | null>(null);

    useEffect(() => {
        const update = () => {setOnline(navigator.onLine); setNotice("");};
        update(); window.addEventListener("online", update); window.addEventListener("offline", update);
        return () => {window.removeEventListener("online", update); window.removeEventListener("offline", update);};
    }, []);

    useEffect(() => {
        // 뒤로 가기로 bfcache에서 복원되면 이동 중 상태를 해제한다.
        const reset = () => setPendingHref(null);
        window.addEventListener("pageshow", reset);
        return () => window.removeEventListener("pageshow", reset);
    }, []);

    useEffect(() => {
        if (!pendingHref) return;
        // 이동이 끝나지 않은 채 멈춰도 탭이 계속 잠겨 보이지 않도록 해제한다.
        const timer = window.setTimeout(() => setPendingHref(null), 15000);
        return () => window.clearTimeout(timer);
    }, [pendingHref]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(""), 3500);
        return () => window.clearTimeout(timer);
    }, [notice]);

    function handleClick(event: MouseEvent<HTMLAnchorElement>, item: (typeof items)[number]) {
        if (!online && ONLINE_ONLY.includes(item.href)) {
            event.preventDefault();
            setNotice(`${item.label} 화면은 인터넷에 연결한 뒤 열 수 있어요.`);
            return;
        }
        // 현재 화면이거나 새 탭/창으로 여는 경우는 지금 화면이 그대로 남으므로 표시하지 않는다.
        if (item.href === pathname || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        setPendingHref(item.href);
    }

    return <nav className="app-navigation" aria-label="주요 메뉴">
        {notice && <p className="navigation-notice" role="status">{notice}</p>}
        {items.map((item) => {
            const pending = pendingHref === item.href;
            return <a
                href={item.href}
                key={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                aria-disabled={!online && ONLINE_ONLY.includes(item.href)}
                aria-busy={pending || undefined}
                data-pending={pending || undefined}
                onClick={(event) => handleClick(event, item)}
            >
                {pending
                    ? <span className="navigation-spinner" aria-hidden="true" />
                    : <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.path} /></svg>}
                <span>{pending ? "여는 중" : item.label}</span>
            </a>;
        })}
    </nav>;
}
