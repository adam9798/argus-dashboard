"use client";

/* eslint-disable @next/next/no-img-element */
// Plain <img> for the event still: it is proxied from the node with the
// session token, not a static asset the image optimizer can fetch.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useEventFeed } from "@/hooks/useEventFeed";
import { eventClipUrl, eventSnapshotUrl, type DetectionEvent } from "@/lib/api";
import { DashboardNav } from "@/components/DashboardNav";
import { NodeGate } from "@/components/NodeGate";
import { FeedModeBadge } from "@/components/FeedModeBadge";
import { EventList } from "@/components/EventList";
import { EventDetailPanel } from "@/components/EventDetailPanel";

// Only what the node flagged. `status: "stranger"` is the head's anomaly
// call — "unusual for this site" — so this page is the alert feed the
// proposal describes, and Confirm/Correct here is what the next
// federated round learns from.
function isAlert(event: DetectionEvent): boolean {
  return event.status === "stranger";
}

export default function AlertsPage() {
  return (
    <NodeGate title="Alerts">
      <AlertsContent />
    </NodeGate>
  );
}

/** Mounted only once the picked node has answered and accepted the sign-in. */
function AlertsContent() {
  const { status } = useAuth();
  const router = useRouter();
  const { events, mode, error, loading, applyLabel } = useEventFeed();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <p className="text-xs text-muted first-letter:uppercase">
          {status === "loading" ? "Checking session…" : "Redirecting…"}
        </p>
      </div>
    );
  }

  const alerts = events.filter(isAlert);
  const unresolvedCount = alerts.filter((event) => !event.confirmed).length;
  // Unreviewed alerts sit at the top whatever their timestamp — an
  // unhandled alert from an hour ago still outranks one already
  // confirmed a minute ago.
  const visible = (unresolvedOnly
    ? alerts.filter((event) => !event.confirmed)
    : alerts
  )
    .slice()
    .sort((a, b) => a.confirmed - b.confirmed);

  const selectedEvent = visible.find((event) => event.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 stagger">
      <DashboardNav title="Alerts" alertCount={unresolvedCount} pickNode />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div
          className={`card flex min-w-[min(100%,260px)] flex-1 items-center gap-4 px-5 py-3 ${
            unresolvedCount > 0 ? "border-danger/45" : ""
          }`}
        >
          <span
            className={`font-mono text-4xl leading-none tabular-nums ${
              unresolvedCount > 0 ? "text-danger" : "text-foreground"
            }`}
          >
            {unresolvedCount}
          </span>
          <span className="text-sm text-muted">
            {unresolvedCount === 1 ? "alert" : "alerts"} awaiting review
          </span>
        </div>
        <button
          onClick={() => setUnresolvedOnly((value) => !value)}
          className="min-h-11 rounded-full border border-border px-5 text-sm text-muted hover:border-accent hover:text-foreground"
        >
          {unresolvedOnly ? "Show reviewed too" : "Unresolved only"}
        </button>
        <FeedModeBadge mode={mode} />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 font-mono text-xs text-danger">
          {error}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-h-[240px] lg:min-h-[420px]">
          {loading ? (
            <div className="flex h-full items-center justify-center card">
              <p className="text-xs text-muted first-letter:uppercase">
                Loading alerts…
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 card px-6 text-center">
              <p className="text-xs text-muted first-letter:uppercase">
                Nothing flagged
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-muted">
                Routine activity stays on the console. Alerts appear here when
                the node judges something unusual for this site.
              </p>
              <Link
                href="/dashboard"
                className="text-xs text-accent first-letter:uppercase"
              >
                Back to console
              </Link>
            </div>
          ) : (
            <EventList
              events={visible}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        <div className="flex flex-col gap-4 lg:min-h-[420px]">
          {/* Keyed so a failed picture is not remembered for the next event. */}
          {selectedEvent && <AlertSnapshot key={selectedEvent.id} event={selectedEvent} />}
          <EventDetailPanel event={selectedEvent} onLabel={applyLabel} />
        </div>
      </div>
    </div>
  );
}

/**
 * The clip the node kept for this event, or its still when there is no
 * clip. Only priority-1 events get footage; the still is the poster.
 */
function AlertSnapshot({ event }: { event: DetectionEvent }) {
  const [failed, setFailed] = useState(false);
  const [clipFailed, setClipFailed] = useState(false);

  if (event.clip && !clipFailed) {
    return (
      <div className="card fade-in overflow-hidden bg-black">
        <video
          key={event.id}
          src={eventClipUrl(event.id)}
          poster={eventSnapshotUrl(event.id)}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full object-contain"
          onError={() => setClipFailed(true)}
        />
        <p className="border-t border-border px-4 py-2 text-xs text-danger first-letter:uppercase">
          Priority 1 · clip
        </p>
      </div>
    );
  }

  if (failed) return null;

  return (
    <div className="card fade-in overflow-hidden bg-black">
      <img
        src={eventSnapshotUrl(event.id)}
        alt={`Still captured for event ${event.id}`}
        className="aspect-video w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
