"use client";

/* eslint-disable @next/next/no-img-element */
// Plain <img> for the event still: it is proxied from the node with the
// session token, not a static asset the image optimizer can fetch.

import { useState } from "react";
import { eventClipUrl, eventSnapshotUrl, type DetectionEvent } from "@/lib/api";

/**
 * The clip the node kept for this event, or its still when there is no
 * clip. Only priority-1 events get footage; the still is the poster.
 *
 * Callers key this on the event id so the failed flags reset when a
 * different event is shown. `showNoClipNote` is for the live page's event
 * viewer, which says outright that no clip was kept instead of leaving
 * the still to speak for itself.
 */
export function EventMedia({
  event,
  showNoClipNote = false,
}: {
  event: DetectionEvent;
  showNoClipNote?: boolean;
}) {
  const [stillFailed, setStillFailed] = useState(false);
  const [clipFailed, setClipFailed] = useState(false);

  if (event.clip && !clipFailed) {
    return (
      <div className="overflow-hidden rounded border border-border bg-black">
        <video
          src={eventClipUrl(event.id)}
          poster={eventSnapshotUrl(event.id)}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full object-contain"
          onError={() => setClipFailed(true)}
        />
        <p className="border-t border-border px-4 py-2 font-mono text-[11px] tracking-widest text-danger uppercase">
          Priority 1 · clip
        </p>
      </div>
    );
  }

  const note = event.clip
    ? "The clip for this event could not be played"
    : "No clip saved for this event";

  if (stillFailed && !showNoClipNote) return null;

  return (
    <div className="overflow-hidden rounded border border-border bg-black">
      {stillFailed ? (
        <div className="flex aspect-video w-full items-center justify-center">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            No snapshot saved
          </p>
        </div>
      ) : (
        <img
          src={eventSnapshotUrl(event.id)}
          alt={`Still captured for event ${event.id}`}
          className="aspect-video w-full object-contain"
          onError={() => setStillFailed(true)}
        />
      )}
      {showNoClipNote && (
        <p className="border-t border-border px-4 py-2 font-mono text-[11px] tracking-widest text-muted uppercase">
          {note}
        </p>
      )}
    </div>
  );
}
