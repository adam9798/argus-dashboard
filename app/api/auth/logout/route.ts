import { NextResponse } from "next/server";
import { DASHBOARD_COOKIE_NAME } from "@/lib/dashboardSession";

// Signs out of the dashboard only. The server's own sign-ins to the
// nodes stay cached: they belong to the dashboard server, not to this
// browser, and the next person to sign in still needs them.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(DASHBOARD_COOKIE_NAME);
  return response;
}
