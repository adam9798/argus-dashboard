"use client";

import { useEffect, useState } from "react";

// Searches the current network for nodes. The dashboard also does this by
// itself; the button is for not waiting.

interface ScanResult {
  subnets: string[];
  found: { name: string; address: string }[];
  moved: string[];
  conflicts: string[];
}

function describe(result: ScanResult): string {
  const where = result.subnets.map((prefix) => `${prefix}.x`).join(", ") || "no network";
  if (result.found.length === 0) {
    return `No nodes answered on ${where}. Check they are powered and on the same network.`;
  }
  const list = result.found.map((node) => `${node.name} (${node.address})`).join(", ");
  const conflicts = result.conflicts.length
    ? ` Two devices both call themselves ${result.conflicts.join(", ")}; give each node its own name.`
    : "";
  return `Found ${list}.${conflicts}`;
}

export function FindNodes({ onFound }: { onFound?: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Show what the automatic scan last found.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/discovery", { cache: "no-store" })
      .then((res) => res.json())
      .then((body: { last: ScanResult | null }) => {
        if (!cancelled && body.last) setMessage((current) => current ?? describe(body.last!));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const find = async () => {
    setScanning(true);
    setMessage("Searching this network…");
    try {
      const res = await fetch("/api/discovery", { method: "POST" });
      const body = (await res.json()) as { last: ScanResult | null };
      setMessage(body.last ? describe(body.last) : "The search did not finish.");
      onFound?.();
    } catch {
      setMessage("Could not reach the dashboard server.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={find}
        disabled={scanning}
        className="rounded border border-accent/60 bg-surface-raised px-3 py-1.5 font-mono text-[11px] tracking-wider text-foreground uppercase transition-colors hover:border-accent disabled:opacity-40"
      >
        {scanning ? "Searching…" : "Find nodes"}
      </button>
      {message && (
        <p role="status" className="min-w-0 text-xs text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
