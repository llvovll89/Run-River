import {createBrowserClient} from "@supabase/ssr";
import type {SupabaseClient} from "@supabase/supabase-js";
import {assertSupabaseEnv, supabaseUrl, supabaseAnonKey} from "@/lib/supabaseEnv";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
    assertSupabaseEnv();

    if (!browserClient) {
        browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
    }

    return browserClient;
}
