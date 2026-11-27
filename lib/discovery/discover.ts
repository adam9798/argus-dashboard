import { configuredNodes, nodeId } from "@/lib/nodes";
import { localAddresses, localSubnets, probe, scanNetwork } from "@/lib/discovery/scan";
import { readDiscovered, writeDiscovered } from "@/lib/discovery/store";

// Keeps node addresses right when the network changes. Server-only.
//
// A scan runs at start-up, when this computer's network changes, when a node
// stops answering, and when someone presses "Find nodes". Nodes are matched
// by the name they report (NODE_NAME on the Pi), so each Pi needs its own.
//
// An address that still answers is never replaced. Moving a node to a new
// address means sign-ins go there, so a second machine claiming the same
// name cannot take over a working node. Run this on networks you trust.

const CHECK_EVERY_MS = 10_000;
const QUICK_RETRY_MS = 60_000;
const SLOW_RETRY_MS = 5 * 60_000;
const QUICK_RETRIES = 3;

export interface ScanResult {
  at: string;
  subnets: string[];
  found: { name: string; address: string }[];
  moved: string[];
  conflicts: string[];
  seconds: number;
}

interface Runtime {
  started: boolean;
  running: Promise<ScanResult> | null;
  last: ScanResult | null;
  lastScanAt: number;
  emptyHanded: number;
  network: string;
  misses: Record<string, number>;
}

const globalForDiscovery = globalThis as unknown as { __argusDiscovery?: Runtime };
const runtime: Runtime = (globalForDiscovery.__argusDiscovery ??= {
  started: false,
  running: null,
  last: null,
  lastScanAt: 0,
  emptyHanded: 0,
  network: "",
  misses: {},
});

/** The usual node port, plus any other port a configured node uses. */
function ports(): number[] {
  const found = new Set<number>([Number(process.env.ARGUS_NODE_PORT) || 8000]);
  for (const node of configuredNodes()) {
    const url = new URL(node.baseUrl);
    if (url.port) found.add(Number(url.port));
  }
  return [...found].slice(0, 3);
}

async function scanAndApply(): Promise<ScanResult> {
  const started = Date.now();
  const subnets = localSubnets();
  const hits = await scanNetwork(ports());

  const byId = new Map<string, typeof hits>();
  for (const hit of hits) {
    const id = nodeId(hit.name);
    if (id) byId.set(id, [...(byId.get(id) ?? []), hit]);
  }

  const known = configuredNodes();
  const saved = new Map(readDiscovered().map((node) => [nodeId(node.name), node]));
  const moved: string[] = [];
  const conflicts: string[] = [];
  let changed = false;

  for (const [id, candidates] of byId) {
    const current = known.find((node) => node.id === id);
    if (current && candidates.some((hit) => hit.baseUrl === current.baseUrl)) continue;
    // Still reachable where it was (a .local name, say): leave it alone.
    if (current) {
      const still = await probe(current.baseUrl);
      if (still && nodeId(still.name) === id) continue;
    }
    if (candidates.length > 1) {
      conflicts.push(candidates[0].name);
      continue;
    }
    const [hit] = candidates;
    saved.set(id, {
      name: current?.name ?? hit.name,
      baseUrl: hit.baseUrl,
      foundAt: new Date().toISOString(),
    });
    moved.push(current?.name ?? hit.name);
    changed = true;
  }

  if (changed) writeDiscovered([...saved.values()]);

  const result: ScanResult = {
    at: new Date().toISOString(),
    subnets,
    found: hits
      .map((hit) => ({ name: hit.name, address: new URL(hit.baseUrl).host }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    moved,
    conflicts,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
  runtime.last = result;
  runtime.emptyHanded = moved.length > 0 ? 0 : runtime.emptyHanded + 1;
  return result;
}

/** Runs one scan; callers that arrive during a scan share its result. */
export function discover(): Promise<ScanResult> {
  if (!runtime.running) {
    runtime.lastScanAt = Date.now();
    runtime.running = scanAndApply().finally(() => {
      runtime.running = null;
      runtime.lastScanAt = Date.now();
    });
  }
  return runtime.running;
}

export function discoveryStatus() {
  return { scanning: runtime.running !== null, last: runtime.last };
}

export function secondsSinceScan(): number {
  return (Date.now() - runtime.lastScanAt) / 1000;
}

async function check(): Promise<void> {
  const network = localAddresses().join(",");
  if (network !== runtime.network) {
    // First check, or this computer moved to another network.
    runtime.network = network;
    runtime.emptyHanded = 0;
    runtime.misses = {};
    if (network) await discover();
    return;
  }

  let lost = false;
  await Promise.all(
    configuredNodes().map(async (node) => {
      const up = await probe(node.baseUrl, 4000);
      runtime.misses[node.id] = up ? 0 : (runtime.misses[node.id] ?? 0) + 1;
      if (runtime.misses[node.id] >= 2) lost = true;
    }),
  );
  if (!lost) {
    runtime.emptyHanded = 0;
    return;
  }

  // A node that is simply switched off must not cause constant scanning.
  const wait = runtime.emptyHanded < QUICK_RETRIES ? QUICK_RETRY_MS : SLOW_RETRY_MS;
  if (Date.now() - runtime.lastScanAt >= wait) await discover();
}

/** Starts watching once per server process. ARGUS_DISCOVERY=off disables it. */
export function startDiscovery(): void {
  if (runtime.started || process.env.ARGUS_DISCOVERY === "off") return;
  runtime.started = true;

  const loop = async () => {
    try {
      await check();
    } catch {
      // A failed check must never stop the next one.
    }
    setTimeout(loop, CHECK_EVERY_MS).unref?.();
  };
  setTimeout(loop, 500).unref?.();
}
