import type { NodeConfig } from "@/lib/nodes";

// Server-side sign-in to each ARGUS node, so the dashboard's one login
// covers every camera. Server-only: node passwords and tokens live in
// this process and never reach the browser.
//
// Per node, the server:
//   1. asks GET /api/auth/me whether the node wants a token at all
//      (AUTH_REQUIRED=false nodes answer auth_required: false);
//   2. if it does, POSTs /api/login with that node's credentials and
//      caches the access_token;
//   3. on a 401 from the node (token expired, node restarted and lost
//      its in-memory tokens), drops the token, signs in again and
//      retries the request once.
//
// A node that rejects the credentials is not retried for a while: the
// node rate-limits failed logins, and hammering it would lock the
// account out for everyone.
//
// Credentials, from .env.local:
//   ARGUS_NODE_CREDS="Node B=admin:secret,Node C=admin:other"
//     keyed by the node's name, label or id; the password is everything
//     after the first ":" (it cannot contain a comma).
//   ARGUS_NODE_USER / ARGUS_NODE_PASSWORD   the default for every node
//     not listed above (user "admin" when unset). No built-in password:
//     a node with none configured is reported as "rejected".

/**
 * open        node does not require a token
 * signed-in   the server holds a token for it
 * rejected    the node turned the credentials down
 * unreachable the node did not answer the sign-in
 */
export type NodeAuthState = "open" | "signed-in" | "rejected" | "unreachable";

export interface NodeAuthEntry {
  state: NodeAuthState;
  token: string | null;
  /** Shown on the node's card when the sign-in did not work. */
  detail: string | null;
  checkedAt: number;
}

const AUTH_TIMEOUT_MS = 2500;
/** Re-ask an open node now and then, in case auth was switched on. */
const OPEN_RECHECK_MS = 5 * 60_000;
/** Back off after a rejected login so the node's rate limit never trips. */
const REJECTED_RETRY_MS = 2 * 60_000;
const UNREACHABLE_RETRY_MS = 15_000;

const DEFAULT_NODE_USER = "admin";

// On globalThis so dev-mode hot reloads keep the tokens instead of
// signing in to every node again on each edit.
interface NodeAuthStore {
  entries: Map<string, NodeAuthEntry>;
  inflight: Map<string, Promise<NodeAuthEntry>>;
}
const globalStore = globalThis as typeof globalThis & { __argusNodeAuth?: NodeAuthStore };
const store: NodeAuthStore = (globalStore.__argusNodeAuth ??= {
  entries: new Map(),
  inflight: new Map(),
});

interface Credentials {
  username: string;
  password: string;
}

function parseCredsList(): Map<string, Credentials> {
  const map = new Map<string, Credentials>();
  for (const entry of (process.env.ARGUS_NODE_CREDS ?? "").split(",")) {
    const at = entry.indexOf("=");
    if (at <= 0) continue;
    const key = entry.slice(0, at).trim().toLowerCase();
    const pair = entry.slice(at + 1);
    const colon = pair.indexOf(":");
    if (!key || colon <= 0) continue;
    map.set(key, { username: pair.slice(0, colon).trim(), password: pair.slice(colon + 1) });
  }
  return map;
}

/** The login for this node, or null when none is configured. */
function nodeCredentials(node: NodeConfig): Credentials | null {
  const list = parseCredsList();
  for (const key of [node.nodeName, node.name, node.id]) {
    const found = list.get(key.toLowerCase());
    if (found) return found;
  }
  const password = process.env.ARGUS_NODE_PASSWORD;
  if (!password) return null;
  return { username: process.env.ARGUS_NODE_USER?.trim() || DEFAULT_NODE_USER, password };
}

function entry(state: NodeAuthState, token: string | null, detail: string | null): NodeAuthEntry {
  return { state, token, detail, checkedAt: Date.now() };
}

/** Does the node want a token? null when it gave no usable answer. */
async function authRequired(node: NodeConfig): Promise<boolean | null> {
  const res = await fetch(`${node.baseUrl}/api/auth/me`, {
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { auth_required?: unknown } | null;
  return typeof body?.auth_required === "boolean" ? body.auth_required : null;
}

async function login(node: NodeConfig): Promise<NodeAuthEntry> {
  const credentials = nodeCredentials(node);
  if (!credentials) {
    return entry("rejected", null, "No node password set: add ARGUS_NODE_PASSWORD to .env.local");
  }
  const res = await fetch(`${node.baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 429) {
    return entry("rejected", null, "Sign-in blocked: too many failed attempts on the node");
  }
  if (!res.ok) {
    return entry("rejected", null, "Sign-in rejected: check this node's login in .env.local");
  }
  const body = (await res.json().catch(() => null)) as { access_token?: unknown } | null;
  const token = typeof body?.access_token === "string" ? body.access_token : null;
  return token
    ? entry("signed-in", token, null)
    : entry("rejected", null, "Node accepted the login but sent no token");
}

async function signIn(node: NodeConfig): Promise<NodeAuthEntry> {
  try {
    // Older node builds have no /api/auth/me; then just try to log in.
    if ((await authRequired(node)) === false) return entry("open", null, null);
    return await login(node);
  } catch {
    return entry("unreachable", null, "Node did not answer the sign-in");
  }
}

function isFresh(cached: NodeAuthEntry): boolean {
  const age = Date.now() - cached.checkedAt;
  switch (cached.state) {
    case "signed-in":
      return true; // until the node answers 401
    case "open":
      return age < OPEN_RECHECK_MS;
    case "rejected":
      return age < REJECTED_RETRY_MS;
    case "unreachable":
      return age < UNREACHABLE_RETRY_MS;
  }
}

/** The node's sign-in state, signing in if needed. Never throws. */
export async function nodeAuth(node: NodeConfig): Promise<NodeAuthEntry> {
  const cached = store.entries.get(node.id);
  if (cached && isFresh(cached)) return cached;

  // One sign-in per node at a time, however many requests are waiting.
  let pending = store.inflight.get(node.id);
  if (!pending) {
    pending = signIn(node).then((result) => {
      store.entries.set(node.id, result);
      store.inflight.delete(node.id);
      return result;
    });
    store.inflight.set(node.id, pending);
  }
  return pending;
}

function forget(node: NodeConfig): void {
  store.entries.delete(node.id);
}

function withToken(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  return { ...init, headers, cache: "no-store" };
}

/**
 * fetch() against a node with its token attached. On a 401 the token is
 * dropped, the server signs in again, and the request is retried once.
 * Network errors are thrown, as with fetch().
 */
export async function nodeFetch(
  node: NodeConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${node.baseUrl}${path}`;
  const first = await nodeAuth(node);
  const res = await fetch(url, withToken(init, first.token));
  if (res.status !== 401) return res;

  // Only worth a retry if a fresh sign-in could change the answer: a
  // stale token, or a node that switched auth on since we last asked.
  if (first.state !== "signed-in" && first.state !== "open") return res;
  forget(node);
  const second = await nodeAuth(node);
  if (!second.token) return res;

  await res.body?.cancel().catch(() => undefined);
  return fetch(url, withToken(init, second.token));
}
