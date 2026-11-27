"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useNodes } from "@/hooks/useNodes";
import { useNodeHealth } from "@/hooks/useNodeHealth";
import { DashboardNav } from "@/components/DashboardNav";
import { NodeSignIn } from "@/components/NodeSignIn";
import { StatusDot } from "@/components/StatusDot";
import type { NodeOption } from "@/lib/nodes";

// For the pages that show one node at a time. Picking a node that is off, or
// that this browser has not signed in to, says so on the page, with the node
// picker still there, instead of throwing the person back to the login screen.

export function NodeGate({ title, children }: { title: string; children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const { nodes, selected } = useNodes();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const node = nodes.find((option) => option.id === selected);

  if (status !== "authenticated" || !node) {
    return (
      <Frame title={title}>
        <p className="sr-only">Loading…</p>
        <div className="skeleton h-64 w-full" />
      </Frame>
    );
  }

  return (
    <Gate key={node.id} title={title} node={node}>
      {children}
    </Gate>
  );
}

function Gate({ title, node, children }: { title: string; node: NodeOption; children: ReactNode }) {
  const { state, recheck } = useNodeHealth(node.id);
  const [wasOnline, setWasOnline] = useState(false);
  if (state === "online" && !wasOnline) setWasOnline(true);

  // A node that drops while it is being read keeps its page: what is already
  // on screen stays, and the page reports the lost connection itself.
  if (state === "online" || (wasOnline && state === "offline")) return children;

  return (
    <Frame title={title}>
      {state === "connecting" ? (
        <>
          <p className="sr-only">Connecting to {node.name}…</p>
          <div className="skeleton h-64 w-full" />
        </>
      ) : state === "signin" ? (
        <section className="card rise mx-auto w-full max-w-md">
          <NodeSignIn nodeId={node.id} nodeName={node.name} onSignedIn={recheck} />
        </section>
      ) : (
        <section className="card rise mx-auto w-full max-w-md border-danger/40 p-8 text-center">
          <p className="flex items-center justify-center gap-3 text-lg text-foreground">
            <StatusDot tone="down" pulse={false} />
            {node.name} is offline
          </p>
          <p className="mt-3 text-sm text-muted">
            Check that it is powered and on this network. This page opens by itself when it
            answers, or pick another node above.
          </p>
        </section>
      )}
    </Frame>
  );
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8">
      <DashboardNav title={title} pickNode />
      {children}
    </div>
  );
}
