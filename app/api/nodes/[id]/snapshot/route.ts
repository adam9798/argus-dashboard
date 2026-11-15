import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { configuredNodes } from "@/lib/nodes";
import { nodeFetch } from "@/lib/nodeAuth";

// One camera still from a specific node, for the "All nodes" grid. The
// grid polls stills rather than opening one MJPEG stream per node: each
// stream holds a browser connection open for good, and browsers allow
// only ~6 per origin, so four streams plus polling would stall the page.
//
// Like /api/argus, the node is an id into ARGUS_NODES, never a URL from
// the browser, and the only upstream path reachable is the snapshot. The node's token is
// attached server-side by lib/nodeAuth.ts.

export const dynamic = "force-dynamic";

const SNAPSHOT_TIMEOUT_MS = 4000;

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/nodes/[id]/snapshot">,
) {
  const { id } = await ctx.params;
  const node = configuredNodes().find((candidate) => candidate.id === id);
  if (!node) {
    return NextResponse.json({ error: `Unknown node: ${id}` }, { status: 404 });
  }

  try {
    const upstream = await nodeFetch(node, "/api/camera/snapshot", {
      signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
    });
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: `Cannot reach ${node.name} at ${node.baseUrl}` },
      { status: 502 },
    );
  }
}
