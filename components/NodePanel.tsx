"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DetectionEvent, LabelPayload } from "@/lib/api";
import type { NodeOption } from "@/lib/nodes";
import { tempColor } from "@/lib/format";
import { useEventFeed } from "@/hooks/useEventFeed";
import { useNodeHealth, type NodeState } from "@/hooks/useNodeHealth";
import { EventDetailPanel } from "./EventDetailPanel";
import { EventList } from "./EventList";
import { FeedModeBadge } from "./FeedModeBadge";
import { LiveFeed } from "./LiveFeed";
import { NodeSignIn } from "./NodeSignIn";
import { StatusDot } from "./StatusDot";

const STATE_COPY: Record<NodeState, string> = {
  connecting: "Connecting…",
  online: "Online",
  offline: "Offline",
  signin: "Sign-in needed",
};

/** What the overview's summary needs to know about one node. */
export interface NodeReport {
  state: NodeState;
  fps: number | null;
  temp: number | null;
  softLimit: number;
}

interface Reporting {
  onHealth: (nodeId: string, report: NodeReport | null) => void;
  /** Null when the panel has no feed, e.g. before sign-in. */
  onEvents: (nodeId: string, events: DetectionEvent[] | null) => void;
}

/**
 * Everything the console shows about one node. Each panel fetches, polls
 * and fails on its own, so a node that goes away only takes its own panel
 * with it.
 */
export function NodePanel({
  node,
  delay = 0,
  onHealth,
  onEvents,
}: { node: NodeOption; delay?: number } & Reporting) {
  const health = useNodeHealth(node.id);
  const { state, status, thermal } = health;
  const reportedName = status?.node;

  const temp = thermal?.current?.soc_temp_c ?? null;
  const soft = thermal?.limits_c.soft ?? 80;
  const throttled = (thermal?.throttled.now.length ?? 0) > 0;
  const fps = status?.fps ?? null;

  useEffect(() => {
    onHealth(node.id, { state, fps, temp, softLimit: soft });
  }, [node.id, state, fps, temp, soft, onHealth]);
  useEffect(() => () => onHealth(node.id, null), [node.id, onHealth]);

  const header = (right?: ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <StatusDot
          tone={state === "online" ? "live" : state === "offline" ? "down" : "idle"}
          pulse={state === "online"}
        />
        <h2 className="truncate text-base font-medium text-foreground">{node.name}</h2>
        {/* The node's own idea of its name labels its events below. */}
        {reportedName && reportedName !== node.name && (
          <span className="truncate text-xs text-muted">reports as {reportedName}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`text-xs ${state === "offline" ? "text-danger" : "text-muted"}`}>
          {STATE_COPY[state]}
        </span>
        {right}
      </div>
    </div>
  );

  const metrics = (
    <dl className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-[repeat(4,auto)]">
      <Reading label="FPS" value={status ? String(status.fps) : "–"} />
      <Reading label="Accelerator" value={status?.accelerator ?? "–"} />
      <Reading label="Model" value={status?.model_version ?? "–"} />
      <Reading
        label="SoC temp"
        value={temp === null ? "–" : `${temp.toFixed(1)}°C${throttled ? " ⚠" : ""}`}
        color={tempColor(temp, soft)}
      />
    </dl>
  );

  return (
    <section
      aria-label={node.name}
      className={`card rise flex min-w-0 flex-col overflow-hidden ${
        state === "offline" ? "border-danger/35" : ""
      }`}
      // No reordering by state: each camera keeps its place on the screen.
      style={{ animationDelay: `${delay}ms` }}
    >
      {state === "signin" ? (
        <>
          {header()}
          <NodeSignIn nodeId={node.id} nodeName={node.name} onSignedIn={health.recheck} />
        </>
      ) : state === "connecting" ? (
        <>
          {header()}
          <div className="px-4 pb-4">
            <div className="skeleton aspect-video w-full" />
            <p className="sr-only">Connecting to {node.name}…</p>
          </div>
        </>
      ) : (
        <NodeContent
          node={node}
          online={state === "online"}
          header={header}
          metrics={metrics}
          onEvents={onEvents}
        />
      )}
    </section>
  );
}

function Reading({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0 bg-surface px-3 py-2.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd
        className="truncate font-mono text-sm text-foreground tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

/** The signed-in panel; mounted only once the node has answered. */
function NodeContent({
  node,
  online,
  header,
  metrics,
  onEvents,
}: {
  node: NodeOption;
  online: boolean;
  header: (right?: ReactNode) => ReactNode;
  metrics: ReactNode;
  onEvents: Reporting["onEvents"];
}) {
  const { events, mode, error, applyLabel } = useEventFeed(node);
  // Held whole, not by id: the event must stay open if a burst of newer
  // ones pushes it out of the feed while it is being read.
  const [selected, setSelected] = useState<DetectionEvent | null>(null);

  useEffect(() => {
    onEvents(node.id, events);
  }, [node.id, events, onEvents]);
  useEffect(() => () => onEvents(node.id, null), [node.id, onEvents]);

  const close = useCallback(() => setSelected(null), []);

  function select(id: number) {
    setSelected(events.find((event) => event.id === id) ?? null);
  }

  // The feed's copy has any label applied since the event was opened.
  const current = selected
    ? (events.find((event) => event.id === selected.id) ?? selected)
    : null;

  return (
    <>
      {header(<FeedModeBadge mode={mode} />)}

      {online ? (
        <>
          <LiveFeed nodeId={node.id} compact />
          {metrics}
        </>
      ) : (
        <p className="border-t border-border px-4 py-4 text-sm text-muted">
          Not answering. Check that it is powered and on this network.
        </p>
      )}

      {online && error && (
        <p className="border-b border-border px-4 py-2 text-xs text-danger">
          Events unavailable: {error}
        </p>
      )}

      {/* A node that dropped keeps what it had already reported. */}
      {(online || events.length > 0) && (
        <div className="h-56">
          <EventList
            events={events.slice(0, 8)}
            selectedId={current?.id ?? null}
            onSelect={select}
            bare
          />
        </div>
      )}

      {current &&
        createPortal(
          <EventDetailOverlay
            event={current}
            nodeName={node.name}
            onClose={close}
            onLabel={applyLabel}
          />,
          document.body,
        )}
    </>
  );
}

/**
 * The event's details over the wall. An overlay rather than a route so
 * the camera streams keep running underneath and closing it is instant.
 */
function EventDetailOverlay({
  event,
  nodeName,
  onClose,
  onLabel,
}: {
  event: DetectionEvent;
  nodeName: string;
  onClose: () => void;
  onLabel: (id: number, payload: LabelPayload) => Promise<void>;
}) {
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement;
    backRef.current?.focus();

    function onKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Event details from ${nodeName}`}
      onClick={(clickEvent) => {
        if (clickEvent.target === clickEvent.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4"
    >
      <div className="sheet-in flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto">
        <button
          ref={backRef}
          onClick={onClose}
          className="card min-h-12 px-4 py-3 text-center text-sm text-foreground transition-colors hover:border-accent"
        >
          ← Back to live view
        </button>
        <div className="min-h-[420px]">
          <EventDetailPanel event={event} onLabel={onLabel} />
        </div>
      </div>
    </div>
  );
}
