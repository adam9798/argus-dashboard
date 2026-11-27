import type { NodeConfig } from "@/lib/nodes";

// The dashboard server's own sign-in to a node, for background work that has
// no browser behind it. Server-only. Used only when a node refuses a request
// without one. A node locks sign-ins after a few failures, so this is shared
// by every background task, tries rarely and gives up until a restart.

const LOGIN_GAP_MS = 5 * 60 * 1000;
const LOGIN_MAX_FAILS = 3;

interface Runtime {
  tokens: Record<string, string>;
  logins: Record<string, { at: number; fails: number }>;
}

const shared = globalThis as unknown as { __argusNodeAuth?: Runtime };
const runtime: Runtime = (shared.__argusNodeAuth ??= { tokens: {}, logins: {} });

/** The token in hand for this node, if any. */
export function cachedToken(node: NodeConfig): string | null {
  return runtime.tokens[node.id] ?? null;
}

export function forgetToken(node: NodeConfig): void {
  delete runtime.tokens[node.id];
}

/** Signs in with ARGUS_ALERT_USER and ARGUS_ALERT_PASS, when both are set. */
export async function serviceToken(node: NodeConfig): Promise<string | null> {
  const user = process.env.ARGUS_ALERT_USER;
  const pass = process.env.ARGUS_ALERT_PASS;
  if (!user || !pass) return null;
  if (runtime.tokens[node.id]) return runtime.tokens[node.id];

  const tries = (runtime.logins[node.id] ??= { at: 0, fails: 0 });
  if (tries.fails >= LOGIN_MAX_FAILS) return null;
  if (Date.now() - tries.at < LOGIN_GAP_MS) return null;
  tries.at = Date.now();

  try {
    const res = await fetch(`${node.baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = res.ok ? ((await res.json()) as { access_token?: string }) : null;
    if (!data?.access_token) {
      tries.fails += 1;
      return null;
    }
    tries.fails = 0;
    runtime.tokens[node.id] = data.access_token;
    return data.access_token;
  } catch {
    return null;
  }
}
