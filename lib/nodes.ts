import { API_BASE_URL } from "@/lib/config";
import { readDiscovered } from "@/lib/discovery/store";

// The ARGUS cameras this dashboard can show. Server-side values: client code
// may only import types from this file.
//
// The list comes from ARGUS_NODES and from network discovery, so the proxy
// can only ever reach a node in it -- the node picked in the browser is an id
// into this list, never a URL, which keeps /api/argus from becoming an open
// relay:
//
//   ARGUS_NODES="Node A=http://10.0.0.140:8000,Node B=http://10.0.0.128:8000"
//
// Unset, the dashboard behaves as before: one node at
// NEXT_PUBLIC_API_BASE_URL.

export const NODE_COOKIE_NAME = "argus_node";

export interface NodeConfig {
  id: string;
  name: string;
  baseUrl: string;
}

/** What the browser is told about a node: no proxy-only details. */
export interface NodeOption {
  id: string;
  name: string;
  /** The node's /ws/events. The socket goes straight to the node. */
  wsUrl: string;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** The id a node of this name gets, e.g. "Node A" -> "node-a". */
export function nodeId(name: string): string {
  return slug(name);
}

/** The nodes named in ARGUS_NODES, as written there. */
function listedNodes(): NodeConfig[] {
  const raw = process.env.ARGUS_NODES?.trim();
  const nodes: NodeConfig[] = [];

  for (const entry of (raw ?? "").split(",")) {
    const at = entry.indexOf("=");
    if (at <= 0) continue;
    const name = entry.slice(0, at).trim();
    const baseUrl = entry.slice(at + 1).trim().replace(/\/+$/, "");
    if (!name || !/^https?:\/\//.test(baseUrl)) continue;
    let id = slug(name) || `node-${nodes.length + 1}`;
    while (nodes.some((node) => node.id === id)) id += "-2";
    nodes.push({ id, name, baseUrl });
  }
  return nodes;
}

/**
 * The nodes whose sign-in opens the console as a whole: the ones listed in
 * ARGUS_NODES, or every known node when none are listed.
 */
export function trustedNodeIds(): string[] {
  const listed = listedNodes();
  return (listed.length > 0 ? listed : configuredNodes()).map((node) => node.id);
}

/**
 * ARGUS_NODES, with each address replaced by where network discovery last
 * found a node of that name. Discovered nodes that ARGUS_NODES does not list
 * are added, so the variable is optional.
 */
export function configuredNodes(): NodeConfig[] {
  const nodes = listedNodes();

  const discovered = [...readDiscovered()].sort((a, b) => a.name.localeCompare(b.name));
  for (const found of discovered) {
    const id = slug(found.name);
    if (!id) continue;
    const listed = nodes.find((node) => node.id === id);
    if (listed) listed.baseUrl = found.baseUrl;
    else nodes.push({ id, name: found.name, baseUrl: found.baseUrl });
  }

  return nodes.length > 0
    ? nodes
    : [{ id: "node", name: "Node", baseUrl: API_BASE_URL }];
}

/** The node with this id, or the first one when the id is unknown. */
export function nodeById(id: string | null | undefined): NodeConfig {
  const nodes = configuredNodes();
  return nodes.find((node) => node.id === id) ?? nodes[0];
}

export function toOption(node: NodeConfig): NodeOption {
  return {
    id: node.id,
    name: node.name,
    wsUrl: node.baseUrl.replace(/^http/, "ws") + "/ws/events",
  };
}
