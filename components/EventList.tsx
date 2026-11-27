import type { DetectionEvent } from "@/lib/api";
import { formatWhen } from "@/lib/format";

export function EventList({
  events,
  selectedId,
  onSelect,
  bare = false,
}: {
  events: DetectionEvent[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Inside a panel that already draws the border. */
  bare?: boolean;
}) {
  return (
    <div className={bare ? "flex h-full flex-col" : "card flex h-full flex-col overflow-hidden"}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm text-muted">Recent events</p>
        <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-xs text-muted">
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <p className="text-sm text-muted">No events</p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border/70 overflow-y-auto">
          {events.map((event) => {
            const isAlert = event.status === "stranger";
            const isSelected = event.id === selectedId;
            return (
              // A new row slides in; an alert arrives with a red wash.
              <li key={event.id} className={isAlert ? "alert-in" : "rise"}>
                <button
                  onClick={() => onSelect(event.id)}
                  className={`flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-raised/70 ${
                    isSelected ? "bg-surface-raised" : ""
                  }`}
                >
                  <span
                    className={`h-7 w-1 shrink-0 rounded-full ${
                      isAlert ? "bg-danger" : "bg-border"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{event.label}</p>
                    <p className="truncate text-xs text-muted">
                      {event.zone} · {event.node}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-mono text-xs text-muted">
                    <p>{formatWhen(event.ts)}</p>
                    <p>{event.confidence}%</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
