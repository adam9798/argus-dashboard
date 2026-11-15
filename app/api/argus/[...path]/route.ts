import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { nodeFetch } from "@/lib/nodeAuth";
import type { NodeConfig } from "@/lib/nodes";
import { findNode } from "@/lib/nodeSessions";
import { selectedNode } from "@/lib/selectedNode";

// Server-side proxy to the ARGUS nodes' API.
//
// The browser only ever talks to this origin, signed in to the
// dashboard (proxy.ts checks the session before this runs). The node's
// own token is attached here, server-side, by lib/nodeAuth.ts, which
// signs in to each node with the credentials in .env.local and refreshes
// the token on a 401. Node tokens and passwords never reach the browser.
//
// `/api/argus/<suffix>` maps to `<backend>/api/<suffix>`, allowlisted
// below -- this is a proxy to specific endpoints, not an open relay to
// anything on the node. <backend> is the node named by `?node=<id>` (the
// side-by-side, labeling and swipe views), or the one picked in the nav
// when there is none. Either way it is looked up by id in ARGUS_NODES
// (lib/nodes.ts), never a URL from the browser.

const GET_ALLOWED = [
  /^status$/,
  /^system\/thermal$/,
  /^system\/thermal\/history$/,
  /^system\/thermal\.csv$/,
  /^events$/,
  /^events\/\d+\/snapshot$/,
  /^events\/\d+\/clip$/,
  /^camera\/snapshot$/,
  /^camera\/stream$/,
  /^federated\/samples$/,
  /^federated\/suggestions$/,
  /^federated\/scores$/,
  /^events\/\d+$/,
];

// Deliberately only labels and machine suggestions, and generating
// suggestions writes nothing but the node's suggestions file. Starting a
// round, bootstrapping synthetic rows and rolling back a model are operator
// decisions made outside this proxy (the round has its own guarded route,
// app/api/fl/round), so /federated/round and /federated/samples/bootstrap
// must never be added.
const POST_ALLOWED = [
  /^events\/\d+\/label$/,
  /^federated\/suggestions\/generate$/,
  // Machine labels for events the model is very sure of. Marked machine on
  // the node, never counted as reviewed, never over a person's label.
  /^federated\/autolabel$/,
];

// The MJPEG stream is an open-ended response; nothing here may be cached
// or buffered into a static payload.
export const dynamic = "force-dynamic";

/** The node this request is for; null when it names an unknown id. */
async function targetNode(request: NextRequest): Promise<NodeConfig | null> {
  const id = request.nextUrl.searchParams.get("node");
  return id === null ? selectedNode() : findNode(id);
}

function unknownNode() {
  return NextResponse.json({ error: "Unknown node" }, { status: 404 });
}

/** The caller's query string, minus the one parameter that is ours. */
function upstreamQuery(request: NextRequest): string {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.delete("node");
  const query = params.toString();
  return query ? `?${query}` : "";
}

function forbidden(suffix: string) {
  return NextResponse.json(
    { error: `Path not proxied: /api/${suffix}` },
    { status: 403 },
  );
}

function unreachable(name: string, baseUrl: string) {
  return NextResponse.json(
    { error: `Cannot reach ${name} at ${baseUrl}` },
    { status: 502 },
  );
}

/** Pass the upstream response straight through, body included. */
function passthrough(upstream: Response): NextResponse {
  const headers = new Headers();
  // The range headers are what let <video> seek a clip instead of
  // downloading it from the start every time.
  for (const name of [
    "content-type",
    "cache-control",
    "content-disposition",
    "content-length",
    "content-range",
    "accept-ranges",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Streams must not be buffered by an intermediary, or the first frame
  // only lands once the camera stops.
  headers.set("cache-control", headers.get("cache-control") ?? "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/argus/[...path]">,
) {
  const suffix = (await ctx.params).path.join("/");
  if (!GET_ALLOWED.some((pattern) => pattern.test(suffix))) {
    return forbidden(suffix);
  }

  const node = await targetNode(request);
  if (!node) return unknownNode();
  const query = upstreamQuery(request);

  try {
    const headers: Record<string, string> = {};
    const range = request.headers.get("range");
    if (range) headers.Range = range;

    const upstream = await nodeFetch(node, `/api/${suffix}${query}`, {
      headers,
      // The browser closing the <img> should tear the camera stream down
      // rather than leave it running against the node.
      signal: request.signal,
    });
    return passthrough(upstream);
  } catch {
    return unreachable(node.name, node.baseUrl);
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/argus/[...path]">,
) {
  const suffix = (await ctx.params).path.join("/");
  if (!POST_ALLOWED.some((pattern) => pattern.test(suffix))) {
    return forbidden(suffix);
  }

  const node = await targetNode(request);
  if (!node) return unknownNode();
  const body = await request.text();

  try {
    const upstream = await nodeFetch(node, `/api/${suffix}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: request.signal,
    });
    return passthrough(upstream);
  } catch {
    return unreachable(node.name, node.baseUrl);
  }
}
