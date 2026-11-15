"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useNodes } from "@/hooks/useNodes";
import { DashboardNav } from "@/components/DashboardNav";
import { NodeCard } from "@/components/NodeCard";
import type { NodeSummary } from "@/lib/nodeSummary";

// Every node in ARGUS_NODES at once: a camera still where the node has a
// running camera, and its status either way. Offline and camera-less
// nodes get a card of their own instead of an error for the whole page.

const STATUS_POLL_MS = 5000;
const SNAPSHOT_REFRESH_MS = 3000;

export default function AllNodesPage() {
  const { status } = useAuth();
  const router = useRouter();
  const { selected, select } = useNodes();
  const [nodes, setNodes] = useState<NodeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/nodes/overview", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { nodes: NodeSummary[] };
        if (!cancelled) {
          setNodes(data.nodes);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Could not load node status (${err instanceof Error ? err.message : "error"})`);
        }
      }
    }

    void load();
    const statusTimer = setInterval(load, STATUS_POLL_MS);
    const snapshotTimer = setInterval(() => setTick((n) => n + 1), SNAPSHOT_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(statusTimer);
      clearInterval(snapshotTimer);
    };
  }, [status]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          {status === "loading" ? "Checking session…" : "Redirecting…"}
        </p>
      </div>
    );
  }

  const onlineCount = nodes?.filter((node) => node.online).length ?? 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-1 flex-col px-6 py-6">
      <DashboardNav title="All nodes" />

      <p className="mb-4 font-mono text-[11px] tracking-widest text-muted uppercase">
        {nodes ? `${onlineCount} of ${nodes.length} nodes online` : "Checking nodes…"}
      </p>

      {error && (
        <div className="mb-6 rounded border border-danger/30 bg-danger/10 px-4 py-3 font-mono text-xs text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {nodes?.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            isSelected={node.id === selected}
            refreshTick={tick}
            onOpen={(id) => void select(id, "/dashboard/live")}
          />
        ))}
      </div>
    </div>
  );
}
