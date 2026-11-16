import {createServerClient} from "@supabase/ssr";
import {NextResponse, type NextRequest} from "next/server";
import {assertSupabaseEnv, supabaseUrl, supabaseAnonKey} from "@/lib/supabaseEnv";
import {TimeoutError, fetchWithTimeout, withTimeout} from "@/lib/withTimeout";

// Each auth request is aborted after this; the outer cap also covers auth-js retry backoff.
const AUTH_REQUEST_TIMEOUT_MS = 3500;
const AUTH_TOTAL_TIMEOUT_MS = 4000;

export async function updateSession(request: NextRequest) {
    assertSupabaseEnv();
    type CookieToSet = {
        name: string;
        value: string;
        options?: Parameters<NextResponse["cookies"]["set"]>[2];
    };

    let response = NextResponse.next({
        request,
    });
    // Once we have answered, late cookie writes would land on a discarded response.
    let settled = false;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        global: {fetch: fetchWithTimeout(AUTH_REQUEST_TIMEOUT_MS)},
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet: CookieToSet[]) {
                if (settled) return;
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

    // A hung auth request must not freeze menu navigation (standalone PWAs show no loading bar).
    try {
        const {
            data: {user},
            error,
        } = await withTimeout(supabase.auth.getUser(), AUTH_TOTAL_TIMEOUT_MS);
        // Network failures (including our aborts) mean "unknown", not "signed out".
        const timedOut = !user && error?.name === "AuthRetryableFetchError";
        return {response, user, timedOut};
    } catch (error) {
        if (error instanceof TimeoutError) return {response, user: null, timedOut: true};
        throw error;
    } finally {
        settled = true;
    }
}

/** True when the request carries a Supabase session cookie (possibly chunked as `.0`, `.1`, ...). */
export function hasAuthCookie(request: NextRequest) {
    return request.cookies.getAll().some(({name}) => /^sb-.+-auth-token(\.\d+)?$/.test(name));
}
