import {NextResponse, type NextRequest} from "next/server";
import {updateSession} from "./lib/supabaseMiddleware";

const AUTH_REQUIRED_ROUTES = ["/history", "/settings"];

function sanitizeNextPath(raw: string | null): string {
    if (!raw) return "/";
    const value = raw.trim();
    if (!value.startsWith("/") || value.startsWith("//")) return "/";
    return value;
}

function isAuthRequiredRoute(pathname: string) {
    return AUTH_REQUIRED_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
}

export async function middleware(request: NextRequest) {
    const {pathname} = request.nextUrl;

    // Public routes should not block on auth/session network calls.
    // This prevents full-site slowdowns/timeouts when auth backend is degraded.
    const needsSessionCheck = isAuthRequiredRoute(pathname) || pathname === "/auth";
    if (!needsSessionCheck) {
        return NextResponse.next();
    }

    const {response, user, unavailable} = await updateSession(request);

    // Supabase가 느리거나 응답하지 않으면 탭을 눌러도 화면이 멈춘 것처럼 보인다.
    // 로그인 여부를 판단할 수 없을 때는 이동을 막지 않고, 각 화면이 직접 상태를 처리한다.
    // (실제 데이터 접근 권한은 RLS가 보호한다.)
    if (unavailable) {
        return response;
    }

    if (!user && isAuthRequiredRoute(pathname)) {
        const requestedPath = `${pathname}${request.nextUrl.search}`;
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/auth";
        redirectUrl.search = "";
        redirectUrl.searchParams.set("next", requestedPath);
        return NextResponse.redirect(redirectUrl);
    }

    if (user && pathname === "/auth") {
        const nextPath = sanitizeNextPath(
            request.nextUrl.searchParams.get("next"),
        );
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = nextPath;
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$).*)",
    ],
};
