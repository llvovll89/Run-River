"use client";

import {useEffect, useRef} from "react";

export type LoginRequest = {
    /** What the user tried to open, e.g. "통계". */
    feature: string;
    /** Where to continue after login. */
    next: string;
    /** One line on what logging in unlocks. */
    reason?: string;
};

export const LOGIN_REASONS: Record<string, string> = {
    "/history": "로그인하면 계정에 저장된 운동 기록과 주간 통계를 볼 수 있어요.",
    "/settings": "로그인하면 프로필과 운동 설정을 계정에 저장하고 다른 기기와 맞출 수 있어요.",
};

export function loginHref(next: string) {
    return `/auth?next=${encodeURIComponent(next)}`;
}

/** Bottom sheet that explains why login is needed before moving to the login screen. */
export default function LoginRequiredSheet({request, onClose}: {request: LoginRequest | null; onClose: () => void}) {
    const loginButton = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        if (!request) return;
        loginButton.current?.focus();
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [request, onClose]);

    if (!request) return null;
    const reason = request.reason ?? LOGIN_REASONS[request.next] ?? "로그인하면 이 기능을 사용할 수 있어요.";
    return <div className="login-sheet-backdrop" onClick={onClose}>
        <div className="login-sheet" role="dialog" aria-modal="true" aria-labelledby="login-sheet-title" onClick={event => event.stopPropagation()}>
            <div className="login-sheet-grip" aria-hidden="true" />
            <h2 id="login-sheet-title">{request.feature} 화면은 로그인이 필요해요</h2>
            <p>{reason}</p>
            <p className="login-sheet-note">운동 기록은 로그인하지 않아도 이 기기에 저장돼요.</p>
            <div className="login-sheet-actions">
                <button type="button" onClick={onClose}>나중에</button>
                <a ref={loginButton} href={loginHref(request.next)}>로그인하기</a>
            </div>
        </div>
    </div>;
}
