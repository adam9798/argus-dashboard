import type { DetectionEvent } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import { EventMedia } from "./EventMedia";

/**
 * One event opened in the live page's main viewer, in place of the
 * camera stream. The stream is unmounted while this is up, so the node
 * is not pushing frames nobody is watching.
 */
export function EventViewer({
  eventId,
  event,
  loading,
  feedError,
  camera,
  onBack,
}: {
  eventId: number;
  /** null when the feed has no event with this id (yet, or at all). */
  event: DetectionEvent | null;
  loading: boolean;
  /** The feed could not load at all, so a missing event proves nothing. */
  feedError: boolean;
  /** The selected node's console label, e.g. "Camera 2". */
  camera: string | null;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col rounded border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
          Event #{eventId} · live paused
        </p>
        <button
          onClick={onBack}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] tracking-[0.2em] text-muted uppercase transition-colors hover:border-accent hover:text-foreground"
        >
          ← Back to live
        </button>
      </div>

      {event ? (
        <>
          <div className="p-4">
            {/* Keyed so a failed clip or still on one event does not
                carry over to the next. */}
            <EventMedia key={event.id} event={event} showNoClipNote />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border px-4 py-4 font-mono text-xs sm:grid-cols-4">
            <Detail label="Label" value={event.label} />
            <Detail label="Time" value={formatTimestamp(event.ts)} />
            <Detail label="Camera" value={camera ?? event.node} />
            <Detail label="Confidence" value={`${event.confidence}%`} />
          </dl>
        </>
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-black px-6 text-center">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            {loading
              ? "Loading event…"
              : feedError
                ? "Couldn't load events from this node"
                : "Event not found"}
          </p>
          {!loading && !feedError && (
            <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted">
              Event #{eventId} is not among this node&apos;s recent events. It
              may belong to another camera or have aged out of the feed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-1 truncate text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}
