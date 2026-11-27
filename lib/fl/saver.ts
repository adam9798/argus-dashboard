import { capture, getJson } from "@/lib/fl/capture";
import type { SaverStatus } from "@/lib/fl/types";
import { cachedToken, forgetToken, serviceToken } from "@/lib/nodeAuth";
import { configuredNodes, trustedNodeIds, type NodeConfig } from "@/lib/nodes";

// Saves training rounds without anyone watching. Server-only; started once
// from instrumentation.ts.
//
// A node holds only its latest round, in memory, so it has to be copied while
// it is there. Every few seconds this asks each node one light question, and
// only when the answer changes does it run the full capture. GET-only: it
// cannot start a round or change a model.

const POLL_MS = 5_000;
/** Capture now and then regardless, e.g. for a model restored by hand. */
const REFRESH_MS = 10 * 60_000;
const ADOPT_MS = 10_000;

interface RoundSummary {
  running: boolean;
  exit_code: number | null;
  run_dir: string | null;
  result: unknown;
  log?: string[];
}

interface Runtime {
  started: boolean;
  status: Record<string, SaverStatus>;
  seen: Record<string, { fingerprint: string; at: number }>;
}

const shared = globalThis as unknown as { __argusRoundSaver?: Runtime };
const runtime: Runtime = (shared.__argusRoundSaver ??= {
  started: false,
  status: {},
  seen: {},
});

function statusOf(node: NodeConfig): SaverStatus {
  const status = (runtime.status[node.id] ??= {
    nodeId: node.id,
    name: node.name,
    checkedAt: null,
    state: "checking",
  });
  status.name = node.name;
  return status;
}

async function check(node: NodeConfig): Promise<void> {
  const status = statusOf(node);
  const url = `${node.baseUrl}/api/federated/round`;

  let res = await getJson<RoundSummary>(url, cachedToken(node), 4_000);
  if (res.status === 401) {
    forgetToken(node);
    const token = await serviceToken(node);
    if (token) res = await getJson<RoundSummary>(url, token, 4_000);
  }

  if (!res.ok || !res.data) {
    status.state = res.status === 401 ? "signin" : "offline";
    status.detail = res.error;
    // Whatever it says when it comes back is read in full.
    delete runtime.seen[node.id];
    return;
  }

  const round = res.data;
  const fingerprint = JSON.stringify([
    round.run_dir,
    round.running,
    round.exit_code,
    round.result !== null,
    round.log?.length,
    round.log?.at(-1),
  ]);
  const last = runtime.seen[node.id];
  if (!last || last.fingerprint !== fingerprint || Date.now() - last.at > REFRESH_MS) {
    const { errors } = await capture(new Map([[node.id, cachedToken(node)]]), [node.id]);
    // A failed copy is tried again on the next poll.
    if (!errors.some((error) => error.startsWith(`${node.name}:`))) {
      runtime.seen[node.id] = { fingerprint, at: Date.now() };
    }
  }
  status.state = "ok";
  status.detail = undefined;
  status.checkedAt = Date.now() / 1000;
}

/** Starts one loop per listed node. ARGUS_FL_SAVER=off disables it. */
export function startRoundSaver(): void {
  if (runtime.started || process.env.ARGUS_FL_SAVER === "off") return;
  runtime.started = true;
  const looping = new Set<string>();

  const poll = async (id: string) => {
    // Looked up each time: discovery can move a node to a new address.
    const node = configuredNodes().find((candidate) => candidate.id === id);
    try {
      if (node) await check(node);
    } catch (err) {
      // Usually a history file that cannot be read; never stop trying.
      if (node) {
        const status = statusOf(node);
        status.state = "error";
        status.detail = err instanceof Error ? err.message : "unknown error";
      }
    }
    setTimeout(() => void poll(id), POLL_MS).unref?.();
  };

  const adopt = () => {
    for (const id of trustedNodeIds()) {
      if (looping.has(id)) continue;
      looping.add(id);
      void poll(id);
    }
    setTimeout(adopt, ADOPT_MS).unref?.();
  };
  setTimeout(adopt, 1500).unref?.();
}

export function saverStatus(): SaverStatus[] {
  const trusted = new Set(trustedNodeIds());
  return configuredNodes()
    .filter((node) => trusted.has(node.id))
    .map((node) => ({ ...statusOf(node) }));
}
