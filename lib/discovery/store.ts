import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "fs";
import path from "path";

// Where each node was last found. Server-only. ARGUS_NODES_FILE moves it.
// Synchronous on purpose: configuredNodes() is called from many places that
// are not async, and the file is a few hundred bytes.

export interface DiscoveredNode {
  name: string;
  baseUrl: string;
  foundAt: string;
}

function nodesFile(): string {
  return process.env.ARGUS_NODES_FILE ?? path.join(process.cwd(), "data", "nodes.json");
}

let cache: { file: string; mtimeMs: number; nodes: DiscoveredNode[] } | null = null;

export function readDiscovered(): DiscoveredNode[] {
  const file = nodesFile();
  try {
    const { mtimeMs } = statSync(file);
    if (cache && cache.file === file && cache.mtimeMs === mtimeMs) return cache.nodes;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { nodes?: DiscoveredNode[] };
    const nodes = (parsed.nodes ?? []).filter(
      (node) => typeof node?.name === "string" && /^https?:\/\//.test(node?.baseUrl ?? ""),
    );
    cache = { file, mtimeMs, nodes };
    return nodes;
  } catch {
    // Missing or unreadable: fall back to ARGUS_NODES alone. The next scan
    // writes a fresh file.
    return [];
  }
}

export function writeDiscovered(nodes: DiscoveredNode[]): void {
  const file = nodesFile();
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify({ version: 1, nodes }, null, 2), "utf8");
  renameSync(temp, file);
  cache = null;
}
