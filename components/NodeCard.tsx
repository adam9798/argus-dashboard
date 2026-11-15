"use client";

/* eslint-disable @next/next/no-img-element */
// Plain <img>: the snapshot is a live camera still behind the session
// proxy, not a static asset next/image could optimise.

import { useState } from "react";
import { nodeSnapshotUrl } from "@/lib/api";
import type { NodeSummary } from "@/lib/nodeSummary";
import { StatusDot } from "./StatusDot";

/** How the dashboard server is signed in to the node, in words. */
const AUTH_NOTE: Record<NodeSummary["auth"], { text: string; bad: boolean }> = {
  "signed-in": { text: "signed in", bad: false },
  open: { text: "no sign-in needed", bad: false },
  rejected: { text: "sign-in rejected", bad: true },
  unreachable: { text: "not signed in", bad: false },
};

const CAMERA_NOTE = {
  off: "Camera not running on this node",
  none: "No camera on this node",
} as const;

export function NodeCard({
  node,
  isSelected,
  refreshTick,
  onOpen,
}: {
  node: NodeSummary;
  /** The node the rest of the dashboard is currently showing. */
  isSelected: boolean;
  /** Bumped by the page on a timer to pull a fresh snapshot. */
  refreshTick: number;
  onOpen: (id: string) => void;
}) {
  const offline = !node.online;

  return (
    <div
      className={`flex flex-col rounded border bg-surface ${
        offline ? "border-danger/40" : isSelected ? "border-accent/60" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs tracking-[0.2em] text-foreground uppercase">
            {node.name}
            {isSelected && <span className="ml-2 text-[10px] text-accent">viewing</span>}
          </p>
          <p className="truncate font-mono text-[10px] text-muted">
            {node.nodeName !== node.name && <span>{node.nodeName} · </span>}
            {node.url}
          </p>
          {node.online && (
            <p
              className={`truncate font-mono text-[10px] uppercase tracking-wider ${
                AUTH_NOTE[node.auth].bad ? "text-danger" : "text-muted"
              }`}
            >
              {AUTH_NOTE[node.auth].text}
            </p>
          )}
        </div>
        <span
          className={`flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase ${
            offline ? "text-danger" : "text-muted"
          }`}
        >
          <StatusDot tone={offline ? "down" : "live"} pulse={!offline} />
          {offline ? "offline" : "online"}
        </span>
      </div>

      <CardMedia node={node} refreshTick={refreshTick} />

      <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 ${offline ? "opacity-50" : ""}`}>
        <Metric label="FPS" value={node.fps === null ? "—" : node.fps.toFixed(1)} />
        <Metric label="Backend" value={node.accelerator ?? "—"} />
        <Metric label="Model" value={node.modelVersion ?? "—"} />
        <Metric
          label="Samples"
          value={
            node.samples
              ? `${node.samples.total} (${node.samples.labelled} labelled)`
              : "—"
          }
        />
      </dl>

      {node.error && (
        <p className="px-4 pb-3 font-mono text-[10px] leading-relaxed text-danger/90">
          {node.error}
        </p>
      )}

      <button
        onClick={() => onOpen(node.id)}
        disabled={offline}
        className="mt-auto border-t border-border px-4 py-3 font-mono text-[11px] tracking-[0.2em] text-muted uppercase transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        {offline ? "Unavailable" : "Open this node"}
      </button>
    </div>
  );
}

function CardMedia({ node, refreshTick }: { node: NodeSummary; refreshTick: number }) {
  // Remember which tick failed, so the next tick tries again on its own.
  const [failedTick, setFailedTick] = useState<number | null>(null);

  let message: string | null = null;
  if (!node.online) message = "Node offline";
  else if (node.camera !== "live") message = CAMERA_NOTE[node.camera];
  else if (failedTick === refreshTick) message = "Snapshot unavailable";

  return (
    <div className="relative aspect-video w-full bg-black">
      {node.online && node.camera === "live" && failedTick !== refreshTick && (
        <img
          src={nodeSnapshotUrl(node.id, refreshTick)}
          alt={`Latest camera still from ${node.name}`}
          className="h-full w-full object-contain"
          onError={() => setFailedTick(refreshTick)}
        />
      )}
      {message && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p
            className={`font-mono text-[11px] tracking-widest uppercase ${
              node.online ? "text-muted" : "text-danger"
            }`}
          >
            {message}
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] tracking-wider text-muted uppercase">{label}</dt>
      <dd className="truncate font-mono text-sm text-foreground">{value}</dd>
    </div>
  );
}
