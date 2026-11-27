"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusDot } from "@/components/StatusDot";

// Where alerts go. Shows whether the Discord webhook is set up, whether the
// watcher can reach each node, and what was last sent. The webhook URL itself
// never reaches the browser.

interface AlertStatus {
  configured: boolean;
  running: boolean;
  nodes: { id: string; name: string; reachable: boolean; error: string | null }[];
  sent: number;
  failed: number;
  last: { at: string; node: string; eventId: number | null; test: boolean } | null;
  lastError: string | null;
}

function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

export function AlertDelivery() {
  const [status, setStatus] = useState<AlertStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts/status", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setStatus((await res.json()) as AlertStatus);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [refresh]);

  const sendTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/alerts/test", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      setMessage(body.ok ? "Test alert sent to Discord." : (body.error ?? "Test failed."));
    } catch {
      setMessage("Could not reach the dashboard server.");
    } finally {
      setTesting(false);
      void refresh();
    }
  };

  const tone = !status || failed ? "idle" : !status.configured ? "idle" : status.failed > 0 && status.lastError ? "down" : "live";
  const label = failed
    ? "Status unavailable"
    : !status
      ? "Checking…"
      : !status.configured
        ? "Not configured"
        : status.lastError
          ? "Delivery failing"
          : "Connected";

  return (
    <section className="card rise mb-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-xs tracking-[0.25em] text-muted uppercase">
            Alert delivery
          </h2>
          <span className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-foreground uppercase">
            <StatusDot tone={tone} pulse={tone === "live"} />
            Discord · {label}
          </span>
        </div>
        <button
          type="button"
          onClick={sendTest}
          disabled={testing || !status?.configured}
          className="rounded border border-accent/60 bg-surface-raised px-3 py-1.5 font-mono text-[11px] tracking-wider text-foreground uppercase transition-colors hover:border-accent disabled:opacity-40"
        >
          {testing ? "Sending…" : "Send test alert"}
        </button>
      </div>

      {status && status.configured && (
        <dl className="mt-4 grid grid-cols-2 gap-3 font-mono sm:grid-cols-4">
          <div className="rounded border border-accent/30 bg-accent/5 p-3">
            <dt className="text-[10px] tracking-[0.2em] text-muted uppercase">Nodes online</dt>
            <dd className="mt-1 text-3xl font-semibold text-accent">
              {status.nodes.filter((node) => node.reachable).length}
              <span className="text-lg text-muted"> / {status.nodes.length}</span>
            </dd>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-foreground">
              {status.nodes.map((node) => (
                <span key={node.id} className="flex items-center gap-1.5">
                  <StatusDot tone={node.reachable ? "live" : "down"} pulse={false} />
                  {node.name}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded border border-border bg-surface-raised p-3">
            <dt className="text-[10px] tracking-[0.2em] text-muted uppercase">Alerts sent</dt>
            <dd className="mt-1 text-3xl font-semibold text-foreground">{status.sent}</dd>
            <p className="mt-2 text-[11px] text-muted">to Discord, text only</p>
          </div>
          <div
            className={`rounded border p-3 ${
              status.failed > 0 ? "border-danger/40 bg-danger/10" : "border-border bg-surface-raised"
            }`}
          >
            <dt className="text-[10px] tracking-[0.2em] text-muted uppercase">Delivery failures</dt>
            <dd
              className={`mt-1 text-3xl font-semibold ${status.failed > 0 ? "text-danger" : "text-foreground"}`}
            >
              {status.failed}
            </dd>
            <p className="mt-2 text-[11px] text-muted">retried, then kept in a log</p>
          </div>
          <div className="rounded border border-border bg-surface-raised p-3">
            <dt className="text-[10px] tracking-[0.2em] text-muted uppercase">Last alert</dt>
            <dd className="mt-1 text-xl font-semibold text-foreground">
              {status.last ? ago(status.last.at, now) : "none yet"}
            </dd>
            <p className="mt-2 text-[11px] text-muted">
              {status.last ? (status.last.test ? "test message" : status.last.node) : "waiting for a stranger"}
            </p>
          </div>
        </dl>
      )}

      {status && !status.configured && (
        <p className="mt-2 text-xs text-muted">
          Set ARGUS_DISCORD_WEBHOOK_URL in .env.local and restart to send stranger alerts to
          Discord. Messages are text only: class, zone, node, time and confidence.
        </p>
      )}
      {status?.lastError && <p className="mt-2 text-xs text-danger">Last error: {status.lastError}</p>}
      {message && <p className="mt-2 text-xs text-muted">{message}</p>}
    </section>
  );
}
