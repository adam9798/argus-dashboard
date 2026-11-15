"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useEventFeed } from "@/hooks/useEventFeed";
import { useNodes } from "@/hooks/useNodes";
import { StatusStrip } from "@/components/StatusStrip";
import { DashboardNav } from "@/components/DashboardNav";
import { FeedModeBadge } from "@/components/FeedModeBadge";
import { LiveFeed } from "@/components/LiveFeed";
import { EventViewer } from "@/components/EventViewer";
import { EventList } from "@/components/EventList";
import { EventDetailPanel } from "@/components/EventDetailPanel";

function SessionNotice({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center">
      <p className="font-mono text-xs tracking-widest text-muted uppercase">
        {text}
      </p>
    </div>
  );
}

// useSearchParams needs a Suspense boundary to keep the route prerenderable.
export default function LivePage() {
  return (
    <Suspense fallback={<SessionNotice text="Checking session…" />}>
      <LiveView />
    </Suspense>
  );
}

/** `?event=<id>` as a number, or null for the live feed. */
function parseEventParam(value: string | null): number | null {
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

// The camera and what the node is making of it, side by side — the view
// the demo runs on. Detection happens on the node; this page only shows
// the frames and the derived events, never stores either.
//
// Clicking an event opens it in the camera's place (`?event=<id>`, so
// back/forward and shared links work) and unmounts the stream until the
// viewer goes back to live.
function LiveView() {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { events, mode, error, loading, applyLabel } = useEventFeed();
  const { nodes, selected } = useNodes();
  const selectedId = parseEventParam(searchParams.get("event"));
  // True once this tab pushed a live -> event history entry, so "Back to
  // live" can pop it (keeping forward working) instead of stacking a new
  // entry. A shared link lands with no such entry behind it.
  const pushedFromLive = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // pushState/replaceState are synced into useSearchParams by the router,
  // without a server round trip.
  const openEvent = useCallback(
    (id: number) => {
      const url = `${pathname}?event=${id}`;
      if (selectedId === null) {
        window.history.pushState(null, "", url);
        pushedFromLive.current = true;
      } else {
        // Event to event swaps in place: one Back still returns to live.
        window.history.replaceState(null, "", url);
      }
    },
    [pathname, selectedId],
  );

  const backToLive = useCallback(() => {
    if (pushedFromLive.current) {
      pushedFromLive.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", pathname);
    }
  }, [pathname]);

  if (status !== "authenticated") {
    return (
      <SessionNotice
        text={status === "loading" ? "Checking session…" : "Redirecting…"}
      />
    );
  }

  const alertCount = events.filter(
    (event) => event.status === "stranger" && !event.confirmed,
  ).length;
  const selectedEvent = events.find((event) => event.id === selectedId) ?? null;
  const camera = nodes.find((node) => node.id === selected)?.name ?? null;
  // The stream is a wall of motion; the last few events are what says
  // whether the node is actually detecting anything in it.
  const recent = events.slice(0, 8);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-1 flex-col px-6 py-6">
      <DashboardNav title="Live feed" alertCount={alertCount} />

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-[240px] flex-1">
          <StatusStrip />
        </div>
        <FeedModeBadge mode={mode} />
      </div>

      {error && (
        <div className="mb-6 rounded border border-danger/30 bg-danger/10 px-4 py-3 font-mono text-xs text-danger">
          {error}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-h-[420px] flex-col gap-6">
          {selectedId === null ? (
            <LiveFeed />
          ) : (
            <EventViewer
              eventId={selectedId}
              event={selectedEvent}
              loading={loading}
              feedError={error !== null && events.length === 0}
              camera={camera}
              onBack={backToLive}
            />
          )}
          <div className="min-h-[220px] flex-1">
            <EventList
              events={recent}
              selectedId={selectedId}
              onSelect={openEvent}
            />
          </div>
        </div>

        <div className="flex min-h-[420px] flex-col gap-4">
          <EventDetailPanel event={selectedEvent} onLabel={applyLabel} />
          <Link
            href="/dashboard/alerts"
            className="rounded border border-border bg-surface px-4 py-3 text-center font-mono text-[11px] tracking-[0.2em] text-muted uppercase transition-colors hover:border-accent hover:text-foreground"
          >
            {alertCount > 0 ? `Review ${alertCount} alerts` : "Alerts feed"}
          </Link>
        </div>
      </div>
    </div>
  );
}
