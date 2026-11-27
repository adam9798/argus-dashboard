import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSessionCookie } from "@/lib/nodeSessions";
import { sendTestAlert } from "@/lib/alerts/watcher";

// Sends one text-only test message to the configured Discord webhook.
export async function POST() {
  const jar = await cookies();
  if (!jar.getAll().some((cookie) => isSessionCookie(cookie.name))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendTestAlert();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
