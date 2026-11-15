import { nodeAuth, nodeFetch, type NodeAuthState } from "@/lib/nodeAuth";
import type { NodeConfig } from "@/lib/nodes";

// One node's health for the "All nodes" overview, built server-side from
// the node's GET /api/status and GET /api/camera/status. Every field is
// read defensively: nodes run different builds, and a camera-less or
// half-booted node must still come back as a card, never as a throw.

/** How long one node gets to answer before its card shows offline. */
export const NODE_TIMEOUT_MS = 2500;

/**
 * live = camera initialised, snapshots available.
 * off  = the node has a camera service but it is not running.
 * none = no camera endpoint answered (camera-less node, or offline).
 */
export type CameraState = "live" | "off" | "none";

export interface NodeSamples {
  total: number;
  labelled: number;
  unlabelled: number;
}

export interface NodeSummary {
  id: string;
  /** Display label ("Camera 2"). */
  name: string;
  /** The node's name in ARGUS_NODES ("Node B"). */
  nodeName: string;
  /** How the dashboard server is signed in to this node. */
  auth: NodeAuthState;
  /** Shown on the card so a wrong or placeholder address is obvious. */
  url: string;
  online: boolean;
  /** Why the node is offline or degraded; null when healthy. */
  error: string | null;
  fps: number | null;
  accelerator: string | null;
  modelVersion: string | null;
  /** The name the node reports for itself (its own config). */
  reportedName: string | null;
  samples: NodeSamples | null;
  camera: CameraState;
  checkedAt: string;
}

type Json = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function readSamples(value: unknown): NodeSamples | null {
  const samples = asObject(value);
  const total = asNumber(samples?.total);
  if (!samples || total === null) return null;
  return {
    total,
    labelled: asNumber(samples.labelled) ?? 0,
    unlabelled: asNumber(samples.unlabelled) ?? 0,
  };
}

function readCamera(res: Response | null, body: Json | null): CameraState {
  if (!res?.ok || !body) return "none";
  return body.initialized === true ? "live" : "off";
}

interface Fetched {
  res: Response | null;
  body: Json | null;
  failure: string | null;
}

async function getJson(node: NodeConfig, path: string): Promise<Fetched> {
  try {
    const res = await nodeFetch(node, path, {
      signal: AbortSignal.timeout(NODE_TIMEOUT_MS),
    });
    const body = res.ok ? asObject(await res.json().catch(() => null)) : null;
    return { res, body, failure: null };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { res: null, body: null, failure: timedOut ? "timed out" : "unreachable" };
  }
}

function statusError(status: Fetched, authDetail: string | null): string | null {
  if (status.failure) return `No answer (${status.failure})`;
  if (status.res?.status === 401) {
    return authDetail ?? "Online, but the node refused the dashboard's token";
  }
  if (!status.res?.ok) return `Status check failed (HTTP ${status.res?.status})`;
  return null;
}

/** Ask one node how it is doing. Never throws. */
export async function fetchNodeSummary(node: NodeConfig): Promise<NodeSummary> {
  // Sign in first (cached after the first call), so the two reads below
  // share one token instead of racing to sign in.
  // A node that did not even answer the sign-in is down: skip the reads
  // rather than wait out two more timeouts.
  const signIn = await nodeAuth(node);
  const unanswered: Fetched = { res: null, body: null, failure: "unreachable" };
  const [status, camera] =
    signIn.state === "unreachable"
      ? [unanswered, unanswered]
      : await Promise.all([
          getJson(node, "/api/status"),
          getJson(node, "/api/camera/status"),
        ]);
  // Re-read: a 401 above may have triggered a fresh sign-in.
  const auth = await nodeAuth(node);

  // Any HTTP answer at all means the node is up, even a 401 or a 500.
  const online = status.res !== null;
  const body = status.body;

  return {
    id: node.id,
    name: node.name,
    nodeName: node.nodeName,
    auth: auth.state,
    url: node.baseUrl,
    online,
    error: statusError(status, auth.detail),
    fps: asNumber(body?.fps),
    accelerator: asString(body?.accelerator),
    modelVersion: asString(body?.model_version),
    reportedName: asString(body?.node),
    samples: readSamples(body?.samples),
    camera: online ? readCamera(camera.res, camera.body) : "none",
    checkedAt: new Date().toISOString(),
  };
}
