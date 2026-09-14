// TEST ONLY — remove before final build.
// Fakes the offline/degraded status-strip look for visual QA. Does not
// touch the real backend, the /api/status fetch, or the WS connection —
// it just flips a boolean the parent passes into <StatusStrip forceOffline />.
"use client";

export function TestOfflineToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(!active)}
      className={`shrink-0 rounded border px-3 py-2 font-mono text-[11px] tracking-wider uppercase transition-colors ${
        active
          ? "border-danger/50 bg-danger/10 text-danger"
          : "border-border text-muted hover:border-accent hover:text-foreground"
      }`}
    >
      {active ? "Restore connection" : "Simulate offline (test only)"}
    </button>
  );
}
