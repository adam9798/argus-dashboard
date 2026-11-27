import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSessionCookie } from "@/lib/nodeSessions";
import { alertStatus } from "@/lib/alerts/watcher";

// Delivery state for the console card. Never includes the webhook URL.
export async function GET() {
  const jar = await cookies();
  if (!jar.getAll().some((cookie) => isSessionCookie(cookie.name))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await alertStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
