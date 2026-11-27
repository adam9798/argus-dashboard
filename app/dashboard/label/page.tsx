"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { LabelWorkspace } from "@/components/label/LabelWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useNodes } from "@/hooks/useNodes";

// Labels are per node, because each node's "routine" is its own site's.
// Tabs here rather than the nav's node picker, which reloads the page and
// would drop the queue position.
export default function LabelPage() {
  const { status } = useAuth();
  const router = useRouter();
  const { nodes, selected, loaded } = useNodes();
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const activeId = picked ?? selected ?? nodes[0]?.id ?? null;
  const active = nodes.find((node) => node.id === activeId) ?? null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 stagger">
      <DashboardNav title="Label events" />

      {status !== "authenticated" || !loaded ? (
        <p className="text-xs text-muted first-letter:uppercase">
          {status === "unauthenticated" ? "Redirecting…" : "Checking session…"}
        </p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Node to label"
            className="mb-4 flex w-fit items-center gap-1 card p-1"
          >
            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                role="tab"
                aria-selected={node.id === activeId}
                onClick={() => setPicked(node.id)}
                className={`rounded-lg px-4 py-2  text-xs  first-letter:uppercase transition-colors ${
                  node.id === activeId
                    ? "bg-surface-raised text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {node.name}
              </button>
            ))}
          </div>

          {active ? (
            <LabelWorkspace
              key={active.id}
              nodeId={active.id}
              nodeName={active.name}
            />
          ) : (
            <p className="font-mono text-xs text-muted">No nodes configured.</p>
          )}
        </>
      )}
    </div>
  );
}
