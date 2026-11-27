import { NextResponse } from "next/server";
import { discover, discoveryStatus, secondsSinceScan } from "@/lib/discovery/discover";

// "Find nodes". Open without a sign-in on purpose: after a network change the
// node addresses are wrong, so nobody could sign in to trigger the scan. It
// reveals no more than /api/nodes does and is rate limited.

export const dynamic = "force-dynamic";

const MIN_GAP_S = 10;

export async function GET() {
  return NextResponse.json(discoveryStatus());
}

export async function POST() {
  const { scanning, last } = discoveryStatus();
  if (!scanning && last && secondsSinceScan() < MIN_GAP_S) {
    return NextResponse.json({ scanning: false, last });
  }
  await discover();
  return NextResponse.json(discoveryStatus());
}
