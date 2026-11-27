import type { DetectionEvent } from "@/lib/api";
import { configuredNodes, type NodeConfig } from "@/lib/nodes";
import { formatAlert, formatTest, dashboardLink } from "@/lib/alerts/format";
import { deliver, webhookUrl } from "@/lib/alerts/discord";
import {
  appendDeadLetter,
  readState,
  serialized,
  writeState,
  type AlertState,
} from "@/lib/alerts/store";

// Server-side alert watcher. Server-only; started once from instrumentation.ts.
//
// It polls each node's events and sends a text-only Discord message for every
// stranger the node flags. The browser does not need to be open, so alerts and
// the record of what was sent survive a closed tab or a restart.
//
// The poll is every POLL_MS, so delivery is within a couple of seconds of the
// node raising the event; this is not the 500 ms PR-3 path.

const POLL_MS = 2000;
const ADOPT_MS = 10_000;
const FRESH_MS = 15 * 60 * 1000; // never replay anything older than this
const MAX_PER_TICK = 5;
const SEEN_KEEP = 300;

interface NodeHealth {
  id: string;
  name: string;
  reachable: boolean;
  lastCheck: string | null;
  error: string | null;
}

interface Runtime {
  started: boolean;
  state: AlertState | null;
  health: Record<string, NodeHealth>;
  tokens: Record<string, string>;
  logins: Record<string, { at: number; fails: number }>;
  lastTestAt: number;
}

// One instance per server process, even across dev-server module reloads.
const globalForAlerts = globalThis as unknown as { __argusAlerts?: Runtime };
const runtime: Runtime = (globalForAlerts.__argusAlerts ??= {
  started: false,
  state: null,
  health: {},
  tokens: {},
  logins: {},
  lastTestAt: 0,
});

async function loadState(): Promise<AlertState> {
  if (!runtime.state) runtime.state = await readState();
  return runtime.state;
}

function persist(state: AlertState): Promise<void> {
  const snapshot = structuredClone(state);
  return serialized(() => writeState(snapshot));
}

// ---- node access -------------------------------------------------------

const LOGIN_GAP_MS = 5 * 60 * 1000;
const LOGIN_MAX_FAILS = 3;

/**
 * Only used when a node refuses unauthenticated reads. A node locks logins
 * after repeated failures, so this tries rarely and gives up after a few
 * failures until the dashboard restarts.
 */
async function serviceToken(node: NodeConfig): Promise<string | null> {
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
    if (!res.ok) {
      tries.fails += 1;
      return null;
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
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

async function fetchEvents(node: NodeConfig): Promise<DetectionEvent[]> {
  const call = (token?: string) =>
    fetch(`${node.baseUrl}/api/events`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

  let res = await call(runtime.tokens[node.id]);
  if (res.status === 401) {
    delete runtime.tokens[node.id];
    const token = await serviceToken(node);
    if (!token) throw new Error("node needs a sign-in (set ARGUS_ALERT_USER and ARGUS_ALERT_PASS)");
    res = await call(token);
  }
  if (!res.ok) throw new Error(`node answered HTTP ${res.status}`);
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) throw new Error("unexpected events response");
  return body as DetectionEvent[];
}

// ---- polling -----------------------------------------------------------

function isFreshStranger(event: DetectionEvent): boolean {
  if (event.status !== "stranger") return false;
  const at = Date.parse(event.ts);
  return Number.isNaN(at) || Date.now() - at <= FRESH_MS;
}

async function pollNode(node: NodeConfig): Promise<void> {
  const health = (runtime.health[node.id] ??= {
    id: node.id,
    name: node.name,
    reachable: false,
    lastCheck: null,
    error: null,
  });
  health.name = node.name;
  health.lastCheck = new Date().toISOString();

  let events: DetectionEvent[];
  try {
    events = await fetchEvents(node);
    health.reachable = true;
    health.error = null;
  } catch (err) {
    health.reachable = false;
    health.error = err instanceof Error ? err.message : "unreachable";
    return;
  }

  const state = await loadState();
  const strangers = events.filter((event) => event.status === "stranger");

  // First sight of a node: what is already there is history, not news.
  if (!state.seen[node.id]) {
    state.seen[node.id] = strangers.map((event) => event.id);
    await persist(state);
    return;
  }

  const seen = new Set(state.seen[node.id]);
  const fresh = strangers
    .filter((event) => !seen.has(event.id))
    .sort((a, b) => a.id - b.id);
  if (fresh.length === 0) return;

  // Too old to be news, or more than a burst: mark handled without sending.
  const sendable = fresh.filter(isFreshStranger).slice(-MAX_PER_TICK);

  for (const event of sendable) {
    try {
      await deliver(formatAlert(event, node.name));
      state.sent += 1;
      state.last = {
        at: new Date().toISOString(),
        node: node.name,
        eventId: event.id,
        test: false,
      };
      state.lastError = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "delivery failed";
      state.failed += 1;
      state.lastError = message;
      await appendDeadLetter({
        at: new Date().toISOString(),
        node: node.name,
        eventId: event.id,
        error: message,
        payload: formatAlert(event, node.name),
      }).catch(() => undefined);
    }
  }

  for (const event of fresh) seen.add(event.id);
  state.seen[node.id] = [...seen].sort((a, b) => a - b).slice(-SEEN_KEEP);
  await persist(state);
}

/** Starts the loops once per server process. Does nothing without a webhook. */
export function startAlertWatcher(): void {
  if (runtime.started || !webhookUrl()) return;
  runtime.started = true;

  // One loop per node, so an offline node's timeout never delays the others.
  // The node is looked up every time because discovery can move it, and new
  // nodes get a loop when they appear.
  const looping = new Set<string>();

  const poll = async (id: string) => {
    try {
      const node = configuredNodes().find((candidate) => candidate.id === id);
      if (node) await pollNode(node);
    } catch {
      // A bad tick must never stop the watcher.
    }
    setTimeout(() => void poll(id), POLL_MS).unref?.();
  };

  const adopt = () => {
    for (const { id } of configuredNodes()) {
      if (looping.has(id)) continue;
      looping.add(id);
      void poll(id);
    }
    setTimeout(adopt, ADOPT_MS).unref?.();
  };
  setTimeout(adopt, 1000).unref?.();
}

// ---- for the API routes -------------------------------------------------

export interface AlertStatus {
  configured: boolean;
  running: boolean;
  nodes: NodeHealth[];
  sent: number;
  failed: number;
  last: AlertState["last"];
  lastError: string | null;
  link: boolean;
}

export async function alertStatus(): Promise<AlertStatus> {
  const state = await loadState();
  // Idempotent. Covers a dev-server that loaded this file after its start-up hook.
  startAlertWatcher();
  const nodes = configuredNodes().map(
    (node) =>
      runtime.health[node.id] ?? {
        id: node.id,
        name: node.name,
        reachable: false,
        lastCheck: null,
        error: null,
      },
  );
  return {
    configured: webhookUrl() !== null,
    running: runtime.started,
    nodes,
    sent: state.sent,
    failed: state.failed,
    last: state.last,
    lastError: state.lastError,
    link: dashboardLink() !== undefined,
  };
}

/** Sends one test message. Rate limited so the button cannot spam the channel. */
export async function sendTestAlert(): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl()) return { ok: false, error: "Discord webhook is not configured" };
  if (Date.now() - runtime.lastTestAt < 5000) {
    return { ok: false, error: "Wait a few seconds between tests" };
  }
  runtime.lastTestAt = Date.now();

  const state = await loadState();
  try {
    await deliver(formatTest());
    state.sent += 1;
    state.last = { at: new Date().toISOString(), node: "-", eventId: null, test: true };
    state.lastError = null;
    await persist(state);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "delivery failed";
    state.failed += 1;
    state.lastError = message;
    await persist(state);
    return { ok: false, error: message };
  }
}
