import {NextResponse} from "next/server";
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function assertEnv() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.",
        );
    }
}

export async function GET(request: Request) {
    assertEnv();

    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/";
    const cookieStore = await cookies();
    type CookieToSet = {
        name: string;
        value: string;
        options?: Parameters<typeof cookieStore.set>[2];
    };

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet: CookieToSet[]) {
                cookiesToSet.forEach(({name, value, options}) =>
                    cookieStore.set(name, value, options),
                );
            },
        },
    });

    if (code) {
        await supabase.auth.exchangeCodeForSession(code);
    }

    const redirectUrl = new URL(next, requestUrl.origin);
    return NextResponse.redirect(redirectUrl);
}
