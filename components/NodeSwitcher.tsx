"use client";

import { useNodes } from "@/hooks/useNodes";

/**
 * Which camera the console is showing, as a tab bar (A, B, C, ...) listed
 * from ARGUS_NODES. With a single node there is nothing to pick, so it
 * renders as a plain label.
 */
export function NodeSwitcher() {
  const { nodes, selected, switching, select } = useNodes();

  if (nodes.length === 0) return null;

  if (nodes.length === 1) {
    return (
      <span className="rounded border border-border bg-surface px-3 py-2 font-mono text-xs tracking-[0.2em] text-muted uppercase">
        {nodes[0].name}
      </span>
    );
  }

  const current = selected ?? nodes[0].id;

  return (
    <div
      role="tablist"
      aria-label="Node"
      className="flex flex-wrap items-center gap-1 rounded border border-border bg-surface p-1"
    >
      {nodes.map((node) => {
        const isActive = node.id === current;
        return (
          <button
            key={node.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={switching}
            onClick={() => {
              if (!isActive) void select(node.id);
            }}
            className={`rounded px-3 py-2 font-mono text-xs tracking-[0.2em] uppercase transition-colors disabled:opacity-50 ${
              isActive
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {node.name}
          </button>
        );
      })}
    </div>
  );
}
