import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE_NAME, isValidSession } from "@/lib/dashboardSession";

// Reports whether this browser holds a valid dashboard session. The
// cookie is HttpOnly, so client code asks here instead of reading it.
export async function GET() {
  const value = (await cookies()).get(DASHBOARD_COOKIE_NAME)?.value;
  return NextResponse.json({ authenticated: isValidSession(value) });
}
