import { NextRequest, NextResponse } from "next/server";
import { hasAnySession } from "@/lib/session";

// Gates the console server-side: any page under /dashboard needs a genuine
// sign-in to at least one node. Which node's data that browser may read is
// enforced per node by the API routes, and each page asks for any further
// sign-in itself, so picking another node never bounces to the login screen.
export function proxy(request: NextRequest) {
  if (!hasAnySession(request.cookies)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
