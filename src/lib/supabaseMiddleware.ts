import {createServerClient} from "@supabase/ssr";
import {NextResponse, type NextRequest} from "next/server";
import {assertSupabaseEnv, supabaseUrl, supabaseAnonKey} from "@/lib/supabaseEnv";

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
