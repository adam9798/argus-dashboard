"use client";

import { useState } from "react";
import { StagingPanel } from "@/components/swipe/StagingPanel";
import { ChevronIcon } from "@/components/icons";
import type { NodeOption } from "@/lib/nodes";

// Staging labels everything a node records as an anomaly, so it is folded away
// to avoid a stray click. It stays mounted while folded: the panel applies the
// labels itself, so unmounting it would silently pause a running session.
export function TrainingTools({ nodes }: { nodes: NodeOption[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  // A running session is never hidden.
  const shown = open || active;

  return (
    <section className={`card p-4 sm:p-5 ${active ? "border-danger/60" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={shown}
        className="flex min-h-11 w-full items-center gap-3 text-left"
      >
        <ChevronIcon width={16} height={16} className={`text-muted transition-transform ${shown ? "rotate-90" : ""}`} />
        <span className="text-base text-foreground">Training tools</span>
        {active ? (
          <span className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white">
            Staging active
          </span>
        ) : (
          <span className="text-sm text-muted">staging mode</span>
        )}
      </button>
      <div className={shown ? "mt-4" : "hidden"}>
        <StagingPanel nodes={nodes} onActiveChange={setActive} />
      </div>
    </section>
  );
}
