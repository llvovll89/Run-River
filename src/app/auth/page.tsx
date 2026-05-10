"use client";

import {useEffect, useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabaseClient";

type AuthMode = "login" | "signup";

export default function AuthPage() {
    const [next, setNext] = useState("/");
    const [mode, setMode] = useState<AuthMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setNext(params.get("next") ?? "/");
    }, []);

    async function handleEmailAuth() {
        setLoading(true);
        setMessage("");
        setError("");

        const supabase = getSupabaseBrowserClient();

        try {
            if (mode === "signup") {
                const {error: signUpError} = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                    },
                });

                if (signUpError) throw signUpError;
                setMessage(
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
            window.location.href = next;
        } catch (e) {
            setError(e instanceof Error ? e.message : "인증에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleAuth() {
        setLoading(true);
        setMessage("");
        setError("");

        const supabase = getSupabaseBrowserClient();
        const {error: oauthError} = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
        });

        if (oauthError) {
            setError(oauthError.message);
            setLoading(false);
        }
    }

    return (
        <main
            className="min-h-dvh px-5 pt-10 pb-8"
            style={{background: "var(--c-bg)"}}
        >
            <section
                className="rounded-3xl p-5"
                style={{
                    background: "var(--c-surface)",
                    border: "1px solid var(--c-border)",
                }}
            >
                <h1
                    style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: "var(--c-text-1)",
                        letterSpacing: "-0.02em",
                    }}
                >
                    Run River 로그인
                </h1>
                <p
                    style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: "var(--c-text-3)",
                    }}
                >
                    로그인 후 내 기록과 프로필을 계정으로 안전하게 관리할 수
                    있습니다.
                </p>

                <div
                    className="mt-4 grid grid-cols-2 gap-2 rounded-2xl p-1"
                    style={{background: "var(--c-elevated)"}}
                >
                    <button
                        onClick={() => setMode("login")}
                        className="rounded-xl py-2 text-sm font-semibold"
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
                        onClick={() => setMode("signup")}
                        className="rounded-xl py-2 text-sm font-semibold"
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

                <div className="mt-4 space-y-3">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="이메일"
                        className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{
                            background: "var(--c-elevated)",
                            border: "1px solid var(--c-border)",
                            color: "var(--c-text-1)",
                        }}
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="비밀번호 (최소 6자)"
                        className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{
                            background: "var(--c-elevated)",
                            border: "1px solid var(--c-border)",
                            color: "var(--c-text-1)",
                        }}
                    />
                </div>

                <button
                    onClick={handleEmailAuth}
                    disabled={loading || !email || password.length < 6}
                    className="mt-4 w-full rounded-2xl py-3 text-sm font-bold"
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

                {message && (
                    <p
                        style={{
                            marginTop: 10,
                            fontSize: 12,
                            color: "var(--c-walk)",
                        }}
                    >
                        {message}
                    </p>
                )}
                {error && (
                    <p
                        style={{
                            marginTop: 10,
                            fontSize: 12,
                            color: "var(--c-danger)",
                        }}
                    >
                        {error}
                    </p>
                )}
            </section>
        </main>
    );
}
