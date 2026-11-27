import { networkInterfaces } from "os";

// Finds ARGUS nodes on whatever network this computer is on. Server-only.
// It asks each address on the local /24 for /api/status and keeps the ones
// that answer like a node. Only private (home / hotspot) ranges are scanned.

const PROBE_TIMEOUT_MS = 2500;
const CONCURRENCY = 96;
const MAX_SUBNETS = 4;

export interface FoundNode {
  name: string;
  baseUrl: string;
}

function isPrivate(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** This computer's private IPv4 addresses. */
export function localAddresses(): string[] {
  const found: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === "IPv4" && !entry.internal && isPrivate(entry.address)) {
        found.push(entry.address);
      }
    }
  }
  return found.sort();
}

/** The /24 prefixes to search, e.g. "192.168.0". */
export function localSubnets(): string[] {
  const prefixes = localAddresses().map((ip) => ip.split(".").slice(0, 3).join("."));
  return [...new Set(prefixes)].slice(0, MAX_SUBNETS);
}

/** The node at this address, or null when nothing there answers like one. */
export async function probe(
  baseUrl: string,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<FoundNode | null> {
  try {
    const res = await fetch(`${baseUrl}/api/status`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
      redirect: "error",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    if (
      typeof body.node !== "string" ||
      !body.node.trim() ||
      typeof body.accelerator !== "string" ||
      typeof body.model_version !== "string"
    ) {
      return null;
    }
    return { name: body.node.trim().slice(0, 40), baseUrl };
  } catch {
    return null;
  }
}

export async function scanNetwork(ports: number[]): Promise<FoundNode[]> {
  const targets: string[] = [];
  for (const prefix of localSubnets()) {
    for (let host = 1; host <= 254; host++) {
      for (const port of ports) targets.push(`http://${prefix}.${host}:${port}`);
    }
  }

  const found: FoundNode[] = [];
  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const node = await probe(targets[next++]);
      if (node) found.push(node);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return found;
}
