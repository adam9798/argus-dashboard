import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasAnySession } from "@/lib/session";
import { alertStatus } from "@/lib/alerts/watcher";

// Delivery state for the console card. Never includes the webhook URL.
export async function GET() {
  if (!hasAnySession(await cookies())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await alertStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
