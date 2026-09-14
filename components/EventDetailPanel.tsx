"use client";

import { useState } from "react";
import type { DetectionEvent, LabelPayload } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";

export function EventDetailPanel({
  event,
  onLabel,
}: {
  event: DetectionEvent | null;
  onLabel: (id: number, payload: LabelPayload) => Promise<void>;
}) {
  if (!event) {
    return (
      <div className="flex h-full items-center justify-center rounded border border-border bg-surface p-6">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          Select an event
        </p>
      </div>
    );
  }

  const isAlert = event.status === "stranger";

  return (
    <div className="flex h-full flex-col rounded border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
            {event.cls}
          </p>
          <h2 className="mt-1 text-lg font-medium text-foreground">
            {event.label}
          </h2>
        </div>
        {isAlert && (
          <span className="shrink-0 rounded border border-danger/40 bg-danger/10 px-2 py-1 font-mono text-[10px] tracking-widest text-danger uppercase">
            Unverified
          </span>
        )}
      </div>

      <dl className="mt-6 space-y-3 font-mono text-xs">
        <Row label="Zone" value={event.zone} />
        <Row label="Node" value={event.node} />
        <Row label="Time" value={formatTimestamp(event.ts)} />
        <Row label="Confidence" value={`${event.confidence}%`} />
        <Row label="Status" value={event.status} />
        <Row label="Confirmed" value={event.confirmed ? "yes" : "no"} />
      </dl>

      {/* Keyed on event.id so the correcting/error state resets cleanly
          whenever a different event is selected, without an effect. */}
      <EventActions key={event.id} event={event} onLabel={onLabel} />
    </div>
  );
}

function EventActions({
  event,
  onLabel,
}: {
  event: DetectionEvent;
  onLabel: (id: number, payload: LabelPayload) => Promise<void>;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [correctedLabel, setCorrectedLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onLabel(event.id, { action: "confirm" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCorrectSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await onLabel(event.id, {
        action: "correct",
        label: correctedLabel || undefined,
      });
      setCorrecting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to correct");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {error && (
        <p className="mt-4 rounded border border-danger/30 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-auto pt-6">
        {!correcting ? (
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 rounded bg-accent py-2 font-mono text-xs font-semibold tracking-[0.2em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => setCorrecting(true)}
              disabled={submitting}
              className="flex-1 rounded border border-border py-2 font-mono text-xs tracking-[0.2em] text-muted uppercase transition-colors hover:border-accent hover:text-foreground disabled:opacity-50"
            >
              Correct
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={correctedLabel}
              onChange={(e) => setCorrectedLabel(e.target.value)}
              placeholder="Corrected label"
              className="w-full rounded border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCorrectSubmit}
                disabled={submitting}
                className="flex-1 rounded bg-accent py-2 font-mono text-xs font-semibold tracking-[0.2em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Submit
              </button>
              <button
                onClick={() => setCorrecting(false)}
                disabled={submitting}
                className="rounded border border-border px-4 py-2 font-mono text-xs tracking-[0.2em] text-muted uppercase transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2">
      <span className="tracking-wider text-muted uppercase">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
