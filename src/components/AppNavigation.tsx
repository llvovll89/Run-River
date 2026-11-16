"use client";

import {usePathname} from "next/navigation";
import {useCallback, useEffect, useRef, useState} from "react";
import {useAuthSession} from "@/hooks/useAuthSession";
import LoginRequiredSheet, {type LoginRequest} from "@/components/LoginRequiredSheet";

const items = [
    {href: "/", label: "운동", path: "M6 20c0-7 12-7 12-14M7 5h.01M17 20h.01"},
    {href: "/local-history", label: "기기 기록", path: "M8 3h8l3 3v15H5V3h3m1 7h6m-6 4h6m-6 4h4"},
    {href: "/history", label: "통계", path: "M5 20V10m7 10V4m7 16v-7"},
    {href: "/settings", label: "설정", path: "M9 4h6l1 3 3 1v8l-3 1-1 3H9l-1-3-3-1V8l3-1 1-3m6 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0"},
];
const ONLINE_ONLY = ["/history", "/settings"];
const LOGIN_ONLY = ["/history", "/settings"];
// Standalone PWAs show no loading bar, so a slow server page looks like an ignored tap.
// Longer than the server's worst case (middleware auth 4s + page queries 5s), so the
// notice only appears when something is really stuck.
const SLOW_NAVIGATION_MS = 12000;
const normalize = (path: string) => path.length > 1 ? path.replace(/\/+$/, "") : path;

export default function AppNavigation() {
    const pathname = normalize(usePathname() ?? "/");
    const [online, setOnline] = useState(true);
    const [notice, setNotice] = useState("");
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const [slow, setSlow] = useState(false);
    const auth = useAuthSession();
    const [loginRequest, setLoginRequest] = useState<LoginRequest | null>(null);
    const closeLogin = useCallback(() => setLoginRequest(null), []);
    const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        const update = () => {setOnline(navigator.onLine); setNotice("");};
        // Returning through the back/forward cache restores this page with the old pending state.
        const reset = () => {clearTimeout(slowTimer.current); setPendingHref(null); setSlow(false);};
        update();
        window.addEventListener("online", update); window.addEventListener("offline", update);
        window.addEventListener("pageshow", reset);
        return () => {
            window.removeEventListener("online", update); window.removeEventListener("offline", update);
            window.removeEventListener("pageshow", reset);
            clearTimeout(slowTimer.current);
        };
    }, []);

    return <><nav className="app-navigation" aria-label="주요 메뉴">
        {notice && <p className="navigation-notice" role="status">{notice}</p>}
        {items.map((item) => {
            const pending = pendingHref === item.href;
            return <a href={item.href} key={item.href} aria-label={item.label} aria-current={pathname === item.href ? "page" : undefined} aria-busy={pending || undefined} aria-disabled={!online && ONLINE_ONLY.includes(item.href)} onClick={(event) => {
                if (!online && ONLINE_ONLY.includes(item.href)) {event.preventDefault(); setNotice(`${item.label} 화면은 인터넷에 연결한 뒤 열 수 있어요.`); return;}
                // Re-tapping restarts the request, so ignore it until we have told the user it is slow.
                if (pending && !slow) {event.preventDefault(); return;}
                // Explain first instead of silently bouncing guests to the login form.
                if (auth.status === "guest" && LOGIN_ONLY.includes(item.href) && pathname !== item.href) {
                    event.preventDefault();
                    setLoginRequest({feature: item.label, next: item.href});
                    return;
                }
                if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || pathname === item.href) return;
                setNotice("");
                setPendingHref(item.href);
                setSlow(false);
                clearTimeout(slowTimer.current);
                slowTimer.current = setTimeout(() => {
                    // Keep the request alive; the page may still arrive.
                    setSlow(true);
                    setNotice(`${item.label} 화면 연결이 느려요. 조금 더 기다리거나 인터넷 연결을 확인해주세요.`);
                }, SLOW_NAVIGATION_MS);
            }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.path} /></svg>
                <span>{pending ? "여는 중…" : item.label}</span>
            </a>;
        })}
    </nav>
    <LoginRequiredSheet request={loginRequest} onClose={closeLogin} /></>;
}
