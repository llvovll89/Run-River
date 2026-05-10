import {createServerClient} from "@supabase/ssr";
import {NextResponse, type NextRequest} from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function assertEnv() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.",
        );
    }
}

export async function updateSession(request: NextRequest) {
    assertEnv();
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

    const {
        data: {user},
    } = await supabase.auth.getUser();

    return {response, user};
}
