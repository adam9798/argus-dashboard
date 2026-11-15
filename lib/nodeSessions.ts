import { cookies } from "next/headers";
import { DASHBOARD_COOKIE_NAME, isValidSession } from "@/lib/dashboardSession";
import { configuredNodes, type NodeConfig } from "@/lib/nodes";

// Server-only helpers for the multi-node routes (side-by-side console,
// labeling, swipe, federated).
//
// There is one sign-in for the whole dashboard (lib/dashboardSession.ts);
// the server signs in to each node itself (lib/nodeAuth.ts). proxy.ts
// already turns away API calls without a valid session, so the checks
// here are a second line for the routes that write files or start
// processes on this PC.

/** The node with exactly this id, or null. For ids sent by the browser. */
export function findNode(id: string): NodeConfig | null {
  return configuredNodes().find((node) => node.id === id) ?? null;
}

/** True when this request carries a valid, signed dashboard session. */
export async function hasDashboardSession(): Promise<boolean> {
  return isValidSession((await cookies()).get(DASHBOARD_COOKIE_NAME)?.value);
}
