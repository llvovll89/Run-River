import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import type {RunningRecord} from "@/types";
import {assertSupabaseEnv, supabaseUrl, supabaseAnonKey} from "@/lib/supabaseEnv";
import {CONNECTION_DELAY_MESSAGE, fetchWithTimeout} from "@/lib/withTimeout";

// Every Supabase request from server pages is aborted after this, so a page cannot hang.
const SERVER_REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_WEIGHT_KG = 70;

export async function getSupabaseServerClient() {
    assertSupabaseEnv();
    const cookieStore = await cookies();
    type CookieToSet = {
        name: string;
        value: string;
        options?: Parameters<typeof cookieStore.set>[2];
    };

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        global: {fetch: fetchWithTimeout(SERVER_REQUEST_TIMEOUT_MS)},
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet: CookieToSet[]) {
                try {
                    cookiesToSet.forEach(({name, value, options}) =>
                        cookieStore.set(name, value, options),
                    );
                } catch {
                    // Server Component 환경에서 setAll이 불가능할 수 있음
                }
            },
        },
    });
}

function isNetworkFailure(error: unknown) {
    const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    return /abort|timeout|fetch failed|시간이 초과/i.test(text);
}

export type HistoryPageData =
    | {signedIn: false}
    | {signedIn: true; records: RunningRecord[]; fetchError: string; weightKg: number};

/**
 * Everything /history needs, from one client and in parallel. Middleware has already validated
 * the user; here the local session only decides guest vs. member, and RLS scopes both queries.
 */
export async function getHistoryPageData(): Promise<HistoryPageData> {
    const supabase = await getSupabaseServerClient();
    const {data: {session}} = await supabase.auth.getSession();
    if (!session) return {signedIn: false};

    const [history, profile] = await Promise.allSettled([
        supabase.from("running_records").select("*").order("created_at", {ascending: false}),
        // RLS (user_id = auth.uid()) returns only this user's row; avoids reading the unverified session.user.
        supabase.from("user_profiles").select("weight").maybeSingle(),
    ]);

    let records: RunningRecord[] = [];
    let fetchError = "";
    const historyError = history.status === "rejected" ? history.reason : history.value.error;
    if (historyError) {
        fetchError = isNetworkFailure(historyError)
            ? CONNECTION_DELAY_MESSAGE
            : historyError instanceof Error || typeof historyError?.message === "string" ? historyError.message : "기록을 불러올 수 없습니다.";
    } else if (history.status === "fulfilled") {
        records = (history.value.data ?? []) as RunningRecord[];
    }

    // Weight only affects calorie estimates; fall back to the default and say so in the log.
    const weight = profile.status === "fulfilled" ? (profile.value.data?.weight as number | null | undefined) : undefined;
    if (profile.status === "rejected" || profile.value.error) {
        console.warn("[history] profile weight unavailable, using default", profile.status === "rejected" ? profile.reason : profile.value.error);
    }
    return {signedIn: true, records, fetchError, weightKg: weight ?? DEFAULT_WEIGHT_KG};
}
