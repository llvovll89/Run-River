"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabaseClient";
import {sanitizeNextPath} from "@/lib/safeRedirect";

type AuthMode = "login" | "signup";

function toKoreanAuthError(rawMessage: string, mode: AuthMode): string {
    const message = rawMessage.toLowerCase();

    if (message.includes("invalid login credentials")) {
        return "이메일 또는 비밀번호가 올바르지 않습니다.";
    }
    if (message.includes("email not confirmed")) {
        return "이메일 인증이 완료되지 않았습니다. 메일함의 인증 링크를 눌러주세요.";
    }
    if (message.includes("user already registered")) {
        return "이미 가입된 이메일입니다. 로그인으로 진행해주세요.";
    }
    if (
        message.includes("password should be at least") ||
        message.includes("password is too short")
    ) {
        return "비밀번호는 최소 6자 이상이어야 합니다.";
    }
    if (
        message.includes("unable to validate email") ||
        message.includes("invalid email") ||
        message.includes("email address is invalid")
    ) {
        return "이메일 형식이 올바르지 않습니다.";
    }
    if (
        message.includes("too many requests") ||
        message.includes("rate limit")
    ) {
        return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    }
    if (
        message.includes("network request failed") ||
        message.includes("failed to fetch") ||
        // iPhone Safari·WKWebView의 연결 실패 메시지
        message.includes("load failed") ||
        message.includes("could not resolve") ||
        message.includes("networkerror")
    ) {
        return typeof navigator !== "undefined" && !navigator.onLine
            ? "인터넷에 연결된 뒤 다시 시도해주세요."
            : "로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.";
    }
    if (message.includes("signup is disabled")) {
        return "현재 회원가입이 비활성화되어 있습니다. 관리자 설정을 확인해주세요.";
    }

    return mode === "signup"
        ? "회원가입 처리 중 문제가 발생했습니다. 입력값을 확인하고 다시 시도해주세요."
        : "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

/** Why the user was sent here, so the login form does not appear out of nowhere. */
function loginPurpose(next: string): string | null {
    if (next.startsWith("/history")) return "통계와 계정 기록은 로그인 후 볼 수 있어요. 로그인하면 바로 이어서 열어드릴게요.";
    if (next.startsWith("/settings")) return "설정은 로그인 후 바꿀 수 있어요. 로그인하면 바로 이어서 열어드릴게요.";
    return null;
}

export default function AuthPage() {
    const router = useRouter();
    const [next, setNext] = useState("/");
    const [mode, setMode] = useState<AuthMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [fieldError, setFieldError] = useState<{
        email?: string;
        password?: string;
    }>({});
    const [showBanner, setShowBanner] = useState(false);
    const [canResendVerification, setCanResendVerification] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resending, setResending] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setNext(sanitizeNextPath(params.get("next")));
    }, []);

    function handleModeChange(nextMode: AuthMode) {
        setMode(nextMode);
        setFieldError({});
        setNotice(null);
        setCanResendVerification(false);
        setResendCooldown(0);
    }

    useEffect(() => {
        if (!notice) {
            setShowBanner(false);
            return;
        }

        setShowBanner(true);
        // 오류는 사용자가 읽고 다시 시도할 때까지 남겨둔다.
        if (notice.type === "error") return;
        const timer = window.setTimeout(() => {
            setShowBanner(false);
        }, 3500);

        return () => window.clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = window.setTimeout(() => {
            setResendCooldown((prev) => prev - 1);
        }, 1000);
        return () => window.clearTimeout(timer);
    }, [resendCooldown]);

    function validateInputs() {
        const nextFieldError: {email?: string; password?: string} = {};
        const emailTrimmed = email.trim();

        if (!emailTrimmed) {
            nextFieldError.email = "이메일을 입력해주세요.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
            nextFieldError.email = "이메일 형식이 올바르지 않습니다.";
        }

        if (!password) {
            nextFieldError.password = "비밀번호를 입력해주세요.";
        } else if (password.length < 6) {
            nextFieldError.password = "비밀번호는 최소 6자 이상이어야 합니다.";
        }

        setFieldError(nextFieldError);
        return Object.keys(nextFieldError).length === 0;
    }

    function showError(text: string) {
        setNotice({type: "error", text});
    }

    function showSuccess(text: string) {
        setNotice({type: "success", text});
    }

    async function handleEmailAuth() {
        if (!validateInputs()) return;

        setLoading(true);
        setNotice(null);
        setFieldError({});
        setCanResendVerification(false);

        const supabase = getSupabaseBrowserClient();

        try {
            if (mode === "signup") {
                const {error: signUpError} = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${process.env.NEXT_PUBLIC_NATIVE_APP === "1" ? (process.env.NEXT_PUBLIC_SITE_URL || "https://run-river.vercel.app") : window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                    },
                });

                if (signUpError) throw signUpError;
                setCanResendVerification(true);
                showSuccess(
                    "회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.",
                );
                return;
            }

            const {error: signInError} = await supabase.auth.signInWithPassword(
                {
                    email,
                    password,
                },
            );

            if (signInError) throw signInError;
            window.location.assign(next);
        } catch (e) {
            const raw = e instanceof Error ? e.message : "인증에 실패했습니다.";
            showError(toKoreanAuthError(raw, mode));
        } finally {
            setLoading(false);
        }
    }

    async function handleResendVerification() {
        if (resending || resendCooldown > 0) return;
        if (!email.trim()) {
            setFieldError((prev) => ({
                ...prev,
                email: "인증 메일 재전송을 위해 이메일을 입력해주세요.",
            }));
            showError("이메일을 입력한 뒤 다시 시도해주세요.");
            return;
        }

        setResending(true);
        setNotice(null);

        try {
            const supabase = getSupabaseBrowserClient();
            const {error} = await supabase.auth.resend({
                type: "signup",
                email: email.trim(),
                options: {
                    emailRedirectTo: `${process.env.NEXT_PUBLIC_NATIVE_APP === "1" ? (process.env.NEXT_PUBLIC_SITE_URL || "https://run-river.vercel.app") : window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                },
            });

            if (error) throw error;
            setResendCooldown(30);
            showSuccess("인증 메일을 다시 보냈습니다. 메일함을 확인해주세요.");
        } catch (e) {
            const raw =
                e instanceof Error ? e.message : "재전송에 실패했습니다.";
            showError(toKoreanAuthError(raw, "signup"));
        } finally {
            setResending(false);
        }
    }

    return (
        <main
            className="auth-screen min-h-dvh px-6 pb-8"
            style={{background: "var(--c-bg)"}}
        >
            <div className="mb-6 flex items-center">
                <button
                    onClick={() => {
                        if (process.env.NEXT_PUBLIC_NATIVE_APP === "1") {
                            window.location.assign("/");
                            return;
                        }
                        if (window.history.length > 1) {
                            router.back();
                            return;
                        }
                        router.push("/");
                    }}
                    className="btn"
                    data-tone="neutral"
                    style={{minHeight: 44, paddingLeft: 10}}
                    aria-label="뒤로가기"
                >
                    <svg
                        aria-hidden="true"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                    뒤로
                </button>
            </div>

            <section>
                <h1
                    style={{
                        fontSize: 28,
                        fontWeight: 780,
                        color: "var(--c-text-1)",
                        letterSpacing: "-0.02em",
                    }}
                >
                    {mode === "login" ? "로그인" : "회원가입"}
                </h1>
                <p
                    style={{
                        marginTop: 8,
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "var(--c-text-2)",
                    }}
                >
                    기록을 계정에 올려두면 휴대폰을 바꿔도 이어서 볼 수 있어요.
                </p>
                {showBanner && notice && (
                    <p
                        role={notice.type === "error" ? "alert" : "status"}
                        className="mt-4 rounded-2xl px-4 py-3"
                        style={{
                            fontSize: 15,
                            fontWeight: 650,
                            lineHeight: 1.5,
                            background: "var(--c-surface)",
                            border: "1px solid currentColor",
                            color: notice.type === "error" ? "var(--c-danger-text)" : "var(--c-walk-text)",
                        }}
                    >
                        {notice.text}
                    </p>
                )}
                {loginPurpose(next) && (
                    <p className="auth-purpose" role="note">
                        {loginPurpose(next)}
                    </p>
                )}

                <div
                    className="mt-4 grid grid-cols-2 gap-2 rounded-2xl p-1"
                    style={{background: "var(--c-elevated)"}}
                >
                    <button
                        onClick={() => handleModeChange("login")}
                        className="rounded-xl min-h-11 text-[15px] font-semibold"
                        style={{
                            background:
                                mode === "login"
                                    ? "var(--c-toss-blue)"
                                    : "transparent",
                            color:
                                mode === "login" ? "#fff" : "var(--c-text-2)",
                        }}
                    >
                        로그인
                    </button>
                    <button
                        onClick={() => handleModeChange("signup")}
                        className="rounded-xl min-h-11 text-[15px] font-semibold"
                        style={{
                            background:
                                mode === "signup"
                                    ? "var(--c-toss-blue)"
                                    : "transparent",
                            color:
                                mode === "signup" ? "#fff" : "var(--c-text-2)",
                        }}
                    >
                        회원가입
                    </button>
                </div>

                <form
                    className="mt-4 space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleEmailAuth();
                    }}
                >
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                            const value = e.target.value;
                            setEmail(value);
                            if (fieldError.email) {
                                setFieldError((prev) => ({
                                    ...prev,
                                    email: undefined,
                                }));
                            }
                        }}
                        placeholder="이메일"
                        className="w-full rounded-2xl px-4 py-3 outline-none"
                        style={{
                            background: "var(--c-elevated)",
                            border: fieldError.email
                                ? "1px solid var(--c-danger)"
                                : "1px solid var(--c-border)",
                            color: "var(--c-text-1)",
                        }}
                    />
                    {fieldError.email && (
                        <p
                            style={{
                                marginTop: 4,
                                fontSize: 14,
                                color: "var(--c-danger-text)",
                            }}
                        >
                            {fieldError.email}
                        </p>
                    )}
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                            const value = e.target.value;
                            setPassword(value);
                            if (fieldError.password) {
                                setFieldError((prev) => ({
                                    ...prev,
                                    password: undefined,
                                }));
                            }
                        }}
                        placeholder="비밀번호 (최소 6자)"
                        className="w-full rounded-2xl px-4 py-3 outline-none"
                        style={{
                            background: "var(--c-elevated)",
                            border: fieldError.password
                                ? "1px solid var(--c-danger)"
                                : "1px solid var(--c-border)",
                            color: "var(--c-text-1)",
                        }}
                    />
                    {fieldError.password && (
                        <p
                            style={{
                                marginTop: 4,
                                fontSize: 14,
                                color: "var(--c-danger-text)",
                            }}
                        >
                            {fieldError.password}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={loading || !email || password.length < 6}
                        className="mt-5 w-full rounded-2xl min-h-14 text-[17px] font-bold"
                        style={{
                            background: loading
                                ? "var(--c-elevated)"
                                : "var(--c-toss-blue)",
                            color: loading ? "var(--c-text-3)" : "#fff",
                            border: "1px solid var(--c-border)",
                        }}
                    >
                        {loading
                            ? "처리 중..."
                            : mode === "login"
                              ? "이메일로 로그인"
                              : "이메일로 회원가입"}
                    </button>

                    {canResendVerification && mode === "signup" && (
                        <button
                            type="button"
                            onClick={() => void handleResendVerification()}
                            disabled={resending || resendCooldown > 0}
                            className="mt-2 w-full rounded-2xl min-h-13 text-[16px] font-semibold"
                            style={{
                                background: "var(--c-elevated)",
                                border: "1px solid var(--c-border)",
                                color:
                                    resending || resendCooldown > 0
                                        ? "var(--c-text-3)"
                                        : "var(--c-text-1)",
                            }}
                        >
                            {resending
                                ? "인증 메일 재전송 중..."
                                : resendCooldown > 0
                                  ? `인증 메일 재전송 (${resendCooldown}s)`
                                  : "인증 메일 다시 보내기"}
                        </button>
                    )}
                </form>

                {/* Google 로그인은 추후 활성화 예정 */}
                {/*
                <div
                    className="my-4 flex items-center gap-2"
                    style={{color: "var(--c-text-3)"}}
                >
                    <div
                        className="h-px flex-1"
                        style={{background: "var(--c-border)"}}
                    />
                    <span style={{fontSize: 11}}>또는</span>
                    <div
                        className="h-px flex-1"
                        style={{background: "var(--c-border)"}}
                    />
                </div>

                <button
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full rounded-2xl py-3 text-sm font-semibold"
                    style={{
                        background: "var(--c-elevated)",
                        border: "1px solid var(--c-border)",
                        color: "var(--c-text-1)",
                    }}
                >
                    Google로 계속하기
                </button>
                */}
            </section>
        </main>
    );
}
