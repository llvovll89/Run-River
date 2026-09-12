export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function assertSupabaseEnv() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.",
        );
    }
}
