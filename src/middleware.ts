import {NextResponse, type NextRequest} from "next/server";
import {updateSession} from "./lib/supabaseMiddleware";

const PUBLIC_ROUTES = ["/auth", "/auth/callback"];

function sanitizeNextPath(raw: string | null): string {
    if (!raw) return "/";
    const value = raw.trim();
    if (!value.startsWith("/") || value.startsWith("//")) return "/";
    return value;
}

function isPublicRoute(pathname: string) {
    return PUBLIC_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
}

export async function middleware(request: NextRequest) {
    const {pathname} = request.nextUrl;
    const {response, user} = await updateSession(request);

    if (!user && !isPublicRoute(pathname)) {
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
