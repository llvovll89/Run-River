import {createBrowserClient} from "@supabase/ssr";
import type {SupabaseClient} from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let browserClient: SupabaseClient | null = null;

function assertEnv() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.",
        );
    }
}

export function getSupabaseBrowserClient() {
    assertEnv();

    if (!browserClient) {
        browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
    }

    return browserClient;
}
