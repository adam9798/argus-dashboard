import { NextRequest, NextResponse } from "next/server";
import { DASHBOARD_COOKIE_NAME, isValidSession } from "@/lib/dashboardSession";

// Every page and API route sits behind the dashboard sign-in. Only the
// login page and the two auth endpoints it needs are open. Pages without
// a session redirect to /login; API calls get a 401 so fetch() callers
// see a clean error instead of a login page's HTML.

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/session"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = request.cookies.get(DASHBOARD_COOKIE_NAME)?.value;
  if (isValidSession(session)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("from", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
