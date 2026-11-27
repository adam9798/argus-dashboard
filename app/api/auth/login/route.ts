import { NextResponse } from "next/server";
import { AUTH_COOKIE_SECURE } from "@/lib/config";
import { selectedNode } from "@/lib/selectedNode";
import { findNode, sessionCookieName } from "@/lib/nodeSessions";
import { SESSION_SECONDS, sealSession } from "@/lib/session";

// FLAG (per CLAUDE.md): POST /api/login currently returns
// { access_token } in the JSON body, not a Set-Cookie header. Until
// Mohammed's backend sets the HttpOnly cookie itself, this route
// handler does it instead — the token passes through this server only
// and is never exposed to client-side JS. Once the backend sets the
// cookie natively, this proxy can just forward the response.
/** Why the node said no, in words that tell the person what to do next. */
function refusal(nodeName: string, res: Response): string {
  if (res.status === 401 || res.status === 403) {
    return `Wrong username or password for ${nodeName}.`;
  }
  if (res.status === 429) {
    // The node locks sign-ins after repeated failures, even correct ones.
    const seconds = Number(res.headers.get("retry-after"));
    const wait =
      seconds > 90
        ? `about ${Math.ceil(seconds / 60)} minutes`
        : seconds > 0
          ? `${Math.ceil(seconds)} seconds`
          : "a few minutes";
    return `Too many failed attempts. ${nodeName} is locked for ${wait}, then try once.`;
  }
  return `${nodeName} could not sign you in (error ${res.status}).`;
}

export async function POST(request: Request) {
  const { node: nodeId, username, password } = await request.json();
  // Each node issues its own tokens, so log in to one node at a time: the
  // panel's node when a panel sent this, otherwise the picked node. The
  // password only ever goes to that node and is not kept here.
  const node =
    nodeId === undefined ? await selectedNode() : findNode(String(nodeId));
  if (!node) {
    return NextResponse.json({ error: "Unknown node" }, { status: 404 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${node.baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      // A Pi can take several seconds to check a password.
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return NextResponse.json(
      { error: `Cannot reach ${node.name} at ${node.baseUrl}` },
      { status: 502 },
    );
  }

  if (!backendRes.ok) {
    return NextResponse.json(
      { error: refusal(node.name, backendRes) },
      { status: backendRes.status },
    );
  }

  const data = await backendRes.json();
  const token: string | undefined = data.access_token;

  if (!token) {
    return NextResponse.json(
      { error: "Backend did not return an access_token" },
      { status: 502 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName(node.id), sealSession(node.id, token), {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });

  return response;
}
