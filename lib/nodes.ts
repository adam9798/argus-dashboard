import { API_BASE_URL } from "@/lib/config";

// The ARGUS cameras this dashboard can show.
//
// ARGUS_NODES is read server-side only, so the proxy can only ever reach
// a node listed here -- the node picked in the browser is an id into this
// list, never a URL, which keeps /api/argus from becoming an open relay:
//
//   ARGUS_NODES="Node A=http://10.0.0.140:8000,Node B=http://10.0.0.128:8000"
//
// A node can carry a display label in front of its name, separated by
// "|". The label is what the console shows; the name stays the node's
// identity (its id, and the key for its credentials in ARGUS_NODE_CREDS):
//
//   ARGUS_NODES="Camera 2|Node B=http://10.0.0.129:8000,Camera 3|Node C=http://10.0.0.139:8000"
//
// Unset, the dashboard behaves as before: one node at
// NEXT_PUBLIC_API_BASE_URL.

export const NODE_COOKIE_NAME = "argus_node";

export interface NodeConfig {
  id: string;
  /** What the console shows: the label, or the node name without one. */
  name: string;
  /** The node's own name from ARGUS_NODES ("Node B"). */
  nodeName: string;
  baseUrl: string;
}

/** What the browser is told about a node: no proxy-only details. */
export interface NodeOption {
  id: string;
  name: string;
  nodeName: string;
  /** The node's /ws/events. The socket goes straight to the node. */
  wsUrl: string;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** "Camera 2|Node B" -> label "Camera 2", name "Node B". */
function splitLabel(raw: string): { label: string; nodeName: string } {
  const bar = raw.indexOf("|");
  if (bar === -1) return { label: "", nodeName: raw.trim() };
  return { label: raw.slice(0, bar).trim(), nodeName: raw.slice(bar + 1).trim() };
}

export function configuredNodes(): NodeConfig[] {
  const raw = process.env.ARGUS_NODES?.trim();
  const nodes: NodeConfig[] = [];

  for (const entry of (raw ?? "").split(",")) {
    const at = entry.indexOf("=");
    if (at <= 0) continue;
    const { label, nodeName } = splitLabel(entry.slice(0, at));
    const baseUrl = entry.slice(at + 1).trim().replace(/\/+$/, "");
    if (!nodeName || !/^https?:\/\//.test(baseUrl)) continue;
    // The id comes from the node name, not the label, so relabelling a
    // camera keeps the browser's saved selection.
    let id = slug(nodeName) || `node-${nodes.length + 1}`;
    while (nodes.some((node) => node.id === id)) id += "-2";
    nodes.push({ id, name: label || nodeName, nodeName, baseUrl });
  }

  return nodes.length > 0
    ? nodes
    : [{ id: "node", name: "Node", nodeName: "Node", baseUrl: API_BASE_URL }];
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
    nodeName: node.nodeName,
    wsUrl: node.baseUrl.replace(/^http/, "ws") + "/ws/events",
  };
}
