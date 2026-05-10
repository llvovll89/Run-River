import {NextResponse, type NextRequest} from "next/server";
import {updateSession} from "./src/lib/supabaseMiddleware";

const PUBLIC_ROUTES = ["/auth", "/auth/callback"];

function isPublicRoute(pathname: string) {
    return PUBLIC_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
}

export async function middleware(request: NextRequest) {
    const {pathname} = request.nextUrl;
    const {response, user} = await updateSession(request);

    if (!user && !isPublicRoute(pathname)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/auth";
        redirectUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(redirectUrl);
    }

    if (user && pathname === "/auth") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/";
        redirectUrl.searchParams.delete("next");
        return NextResponse.redirect(redirectUrl);
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$).*)",
    ],
};
