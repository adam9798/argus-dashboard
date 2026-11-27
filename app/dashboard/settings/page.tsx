"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { NODES_CHANGED_EVENT, useNodes } from "@/hooks/useNodes";
import { DashboardNav } from "@/components/DashboardNav";
import { AlertDelivery } from "@/components/AlertDelivery";
import { FindNodes } from "@/components/FindNodes";

/** "ws://192.168.0.5:8000/ws/events" -> "192.168.0.5:8000" */
function address(wsUrl: string): string {
  try {
    return new URL(wsUrl).host;
  } catch {
    return wsUrl;
  }
}

export default function SettingsPage() {
  const { status } = useAuth();
  const router = useRouter();
  const { nodes } = useNodes();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <p className="text-sm text-muted">
          {status === "loading" ? "Checking session…" : "Redirecting…"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-8">
      <DashboardNav title="Settings" />

      <AlertDelivery />

      <section className="card rise p-4 sm:p-5">
        <h2 className="mb-1 text-base text-foreground">Nodes</h2>
        <p className="mb-4 text-sm text-muted">
          The dashboard finds nodes on this network by itself. Search now if one has just been
          switched on.
        </p>
        <FindNodes onFound={() => window.dispatchEvent(new Event(NODES_CHANGED_EVENT))} />
        <ul className="mt-4 divide-y divide-border">
          {nodes.map((node) => (
            <li key={node.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="text-sm text-foreground">{node.name}</span>
              <span className="font-mono text-xs break-all text-muted">{address(node.wsUrl)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
