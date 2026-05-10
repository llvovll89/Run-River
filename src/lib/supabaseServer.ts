import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import type {RunningRecord} from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function assertEnv() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.",
        );
    }
}

export async function getSupabaseServerClient() {
    assertEnv();
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
