import { NextResponse } from "next/server";
import { configuredNodes } from "@/lib/nodes";
import { fetchNodeSummary } from "@/lib/nodeSummary";

// The "All nodes" overview: every node in ARGUS_NODES asked in parallel,
// server-side, each signed in to with its own token by lib/nodeAuth.ts,
// the same way the /api/argus proxy does it. A dead node costs at most NODE_TIMEOUT_MS
// and comes back as an offline entry, so one bad node never blanks the
// page.

export const dynamic = "force-dynamic";

export async function GET() {
  const nodes = await Promise.all(
    configuredNodes().map((node) => fetchNodeSummary(node)),
  );
  return NextResponse.json({ nodes });
}
