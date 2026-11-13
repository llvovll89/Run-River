"use client";

import {usePathname} from "next/navigation";
import {useEffect, useState} from "react";

const items = [
    {href: "/", label: "운동", path: "M6 20c0-7 12-7 12-14M7 5h.01M17 20h.01"},
    {href: "/local-history", label: "기기 기록", path: "M8 3h8l3 3v15H5V3h3m1 7h6m-6 4h6m-6 4h4"},
    {href: "/history", label: "통계", path: "M5 20V10m7 10V4m7 16v-7"},
    {href: "/settings", label: "설정", path: "M9 4h6l1 3 3 1v8l-3 1-1 3H9l-1-3-3-1V8l3-1 1-3m6 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0"},
];

export default function AppNavigation() {
    const pathname = usePathname();
    const [online, setOnline] = useState(true);
    const [notice, setNotice] = useState("");
    useEffect(() => {
        const update = () => {setOnline(navigator.onLine); setNotice("");};
        update(); window.addEventListener("online", update); window.addEventListener("offline", update);
        return () => {window.removeEventListener("online", update); window.removeEventListener("offline", update);};
    }, []);
    return <nav className="app-navigation" aria-label="주요 메뉴">
        {notice && <p className="navigation-notice" role="status">{notice}</p>}
        {items.map((item) => <a href={item.href} key={item.href} aria-current={pathname === item.href ? "page" : undefined} aria-disabled={!online && ["/history", "/settings"].includes(item.href)} onClick={(event) => {
            if (!online && ["/history", "/settings"].includes(item.href)) {event.preventDefault(); setNotice(`${item.label} 화면은 인터넷에 연결한 뒤 열 수 있어요.`);}
        }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.path} /></svg>
            <span>{item.label}</span>
        </a>)}
    </nav>;
}
