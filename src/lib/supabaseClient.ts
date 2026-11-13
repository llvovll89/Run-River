import {createBrowserClient} from "@supabase/ssr";
import {createClient} from "@supabase/supabase-js";
import type {SupabaseClient} from "@supabase/supabase-js";
import {assertSupabaseEnv, supabaseUrl, supabaseAnonKey} from "@/lib/supabaseEnv";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
    assertSupabaseEnv();

    if (!browserClient) {
        browserClient = process.env.NEXT_PUBLIC_NATIVE_APP === "1"
            ? createClient(supabaseUrl, supabaseAnonKey)
            : createBrowserClient(supabaseUrl, supabaseAnonKey);
    }

    return browserClient;
}
