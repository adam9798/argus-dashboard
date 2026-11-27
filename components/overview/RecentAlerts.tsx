"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DetectionEvent } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import { ChevronIcon } from "@/components/icons";

export interface NodeAlert {
  nodeId: string;
  nodeName: string;
  event: DetectionEvent;
}

const SHOWN = 6;

/** Unconfirmed alerts from every node, newest first. */
export function RecentAlerts({ alerts }: { alerts: NodeAlert[] }) {
  const router = useRouter();

  // The alerts page follows the picked node, so pick this one on the way.
  const open = async (nodeId: string) => {
    await fetch("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nodeId }),
    }).catch(() => undefined);
    router.push("/dashboard/alerts");
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base text-foreground">
          Alerts to review <span className="text-muted">all nodes</span>
        </h2>
        <Link href="/dashboard/alerts" className="text-sm text-accent hover:underline">
          Open alerts
        </Link>
      </div>

      {alerts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Nothing waiting for review.</p>
      ) : (
        <ul className="divide-y divide-border">
          {alerts.slice(0, SHOWN).map(({ nodeId, nodeName, event }) => (
            <li key={`${nodeId}-${event.id}-${event.ts}`} className="alert-in rounded-xl">
              <button
                type="button"
                onClick={() => void open(nodeId)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-raised/70"
              >
                <span className="h-8 w-1 shrink-0 rounded-full bg-danger" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{event.label}</span>
                  <span className="block truncate text-xs text-muted">
                    {nodeName} · {event.zone} · {formatTimestamp(event.ts)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-raised px-2.5 py-1 font-mono text-xs text-foreground">
                  {event.confidence}%
                </span>
                <ChevronIcon width={16} height={16} className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > SHOWN && (
        <p className="mt-2 text-center text-xs text-muted">{alerts.length - SHOWN} more waiting</p>
      )}
    </div>
  );
}
