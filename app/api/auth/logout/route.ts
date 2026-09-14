import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/config";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
