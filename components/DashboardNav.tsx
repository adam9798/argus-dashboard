"use client";

import { NodeSwitcher } from "@/components/NodeSwitcher";
import { useAlertBadge } from "@/components/shell/AppShell";
import { LogoMark } from "@/components/icons";

// The header of a console page. Navigation lives in AppShell; each page still
// renders this itself because it owns its data and its title.
export function DashboardNav({
  title,
  alertCount,
  pickNode = false,
}: {
  title: string;
  /** Unconfirmed alerts, badged on the Alerts link. Omit where unknown. */
  alertCount?: number;
  /** Only for pages that show one node at a time; the rest show them all. */
  pickNode?: boolean;
}) {
  useAlertBadge(alertCount);

  // "Security Overview" reads as a bright word followed by a quiet one.
  const split = title.lastIndexOf(" ");
  const lead = split > 0 ? title.slice(0, split) : title;
  const tail = split > 0 ? title.slice(split + 1) : "";

  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-1 flex items-center gap-2 font-mono text-xs tracking-widest text-muted lg:hidden">
          <LogoMark width={18} height={18} className="text-accent" />
          ARGUS
        </p>
        <h1 className="font-mono text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
          {lead}
          {tail && <span className="text-accent/70"> {tail}</span>}
        </h1>
      </div>
      {pickNode && <NodeSwitcher />}
    </header>
  );
}
