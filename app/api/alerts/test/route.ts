import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasAnySession } from "@/lib/session";
import { sendTestAlert } from "@/lib/alerts/watcher";

// Sends one text-only test message to the configured Discord webhook.
export async function POST() {
  if (!hasAnySession(await cookies())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendTestAlert();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
