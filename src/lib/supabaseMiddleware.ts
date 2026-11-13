import {createServerClient} from "@supabase/ssr";
import {NextResponse, type NextRequest} from "next/server";
import type {User} from "@supabase/supabase-js";
import {assertSupabaseEnv, supabaseUrl, supabaseAnonKey} from "@/lib/supabaseEnv";
import {withTimeout} from "@/lib/withTimeout";

// 세션 확인이 이보다 오래 걸리면 화면 이동을 막지 않고 통과시킨다.
const AUTH_CHECK_TIMEOUT_MS = 2500;

export type SessionCheck = {
    response: NextResponse;
    user: User | null;
    /** Supabase가 응답하지 않거나 설정이 없어 로그인 여부를 판단하지 못한 경우 */
    unavailable: boolean;
};

export async function updateSession(request: NextRequest): Promise<SessionCheck> {
    try {
        assertSupabaseEnv();
    } catch {
        return {response: NextResponse.next({request}), user: null, unavailable: true};
    }
    type CookieToSet = {
        name: string;
        value: string;
        options?: Parameters<NextResponse["cookies"]["set"]>[2];
    };

    let response = NextResponse.next({
        request,
    });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet: CookieToSet[]) {
                cookiesToSet.forEach(({name, value}) =>
                    request.cookies.set(name, value),
                );
                response = NextResponse.next({
                    request,
                });
                cookiesToSet.forEach(({name, value, options}) =>
                    response.cookies.set(name, value, options),
                );
            },
        },
    });

    try {
        const {
            data: {user},
            error,
        } = await withTimeout(
            supabase.auth.getUser(),
            AUTH_CHECK_TIMEOUT_MS,
            "로그인 확인",
        );
        // 세션 없음·만료 토큰 같은 오류는 정상적인 비로그인 상태로 보고 로그인 화면으로 보낸다.
        // 네트워크 실패나 Supabase 서버 장애(5xx)만 로그인 여부를 알 수 없는 상태로 본다.
        const unavailable =
            !user &&
            !!error &&
            (error.name === "AuthRetryableFetchError" ||
                (error.status ?? 0) >= 500);
        return {response, user, unavailable};
    } catch {
        return {response, user: null, unavailable: true};
    }
}
