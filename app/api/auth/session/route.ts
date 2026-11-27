import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasAnySession } from "@/lib/session";

// Reports auth state from the HttpOnly cookies — the client never touches a
// raw token. Only a cookie this server signed, and that has not expired,
// counts. A node that has since dropped the token still answers 401 itself,
// which the proxy passes back.
export async function GET() {
  return NextResponse.json({ authenticated: hasAnySession(await cookies()) });
}
