import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import type {RunningRecord} from "@/types";
import {assertSupabaseEnv, supabaseUrl, supabaseAnonKey} from "@/lib/supabaseEnv";

export async function getSupabaseServerClient() {
    assertSupabaseEnv();
    const cookieStore = await cookies();
    type CookieToSet = {
        name: string;
        value: string;
        options?: Parameters<typeof cookieStore.set>[2];
    };

    return createServerClient(supabaseUrl, supabaseAnonKey, {
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

export async function getRunningHistoryServer(): Promise<RunningRecord[]> {
    const supabase = await getSupabaseServerClient();
    const {data, error} = await supabase
        .from("running_records")
        .select("*")
        .order("created_at", {ascending: false});

    if (error) throw error;
    return (data ?? []) as RunningRecord[];
}

// 비로그인/에러 시 기본값 70 반환
export async function getProfileWeightServer(): Promise<number> {
    try {
        const supabase = await getSupabaseServerClient();
        const {
            data: {user},
        } = await supabase.auth.getUser();
        if (!user) return 70;
        const {data} = await supabase
            .from("user_profiles")
            .select("weight")
            .eq("user_id", user.id)
            .single();
        return (data?.weight as number | null) ?? 70;
    } catch {
        return 70;
    }
}
