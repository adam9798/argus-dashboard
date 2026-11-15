"use client";

import { useCallback, useEffect, useState } from "react";
import { AMBER, formatEpoch } from "@/lib/format";
import type { RoundMode, RoundNodeState, RoundStateResponse } from "@/lib/fl/round";
import type { GateScore } from "@/lib/fl/types";

// Live round state plus the two buttons that open the Git Bash window on
// this PC. The round itself is run-round.sh; this panel only launches it.

const FAST_POLL_MS = 4_000;
const SLOW_POLL_MS = 15_000;
const TH = "py-1.5 pr-4 font-normal text-muted";
const TD = "py-1.5 pr-4 align-top text-foreground";
const BUTTON =
  "rounded border px-3 py-1.5 font-sans text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

function score(s: GateScore | undefined): string {
  if (!s) return "n/a";
  const p = (v: number | null | undefined) => (v == null ? "?" : `${(v * 100).toFixed(0)}%`);
  return `acc ${p(s.accuracy)} · bal ${p(s.balanced_accuracy)} · recall ${p(s.anomaly_recall)} · loss ${s.loss?.toFixed(3) ?? "?"}`;
}

function LastRound({ node }: { node: RoundNodeState }) {
  const r = node.lastResult;
  if (!r) {
    return <span className="text-muted">{node.lastStarted ? "no result (round failed?)" : "none yet"}</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className={r.accepted ? "text-accent" : ""} style={r.accepted ? undefined : { color: AMBER }}>
        {r.accepted ? "✓ accepted" : "✕ rejected"}
        {r.at ? <span className="text-muted"> · {formatEpoch(r.at)}</span> : null}
        {r.val_samples !== undefined && <span className="text-muted"> · {r.val_samples} val</span>}
      </span>
      <span className="text-muted">new: {score(r.candidate)}</span>
      <span className="text-muted">old: {score(r.current)}</span>
      {r.reason && <span className="text-muted">why: {r.reason}</span>}
    </div>
  );
}

export function RoundControl() {
  const [data, setData] = useState<RoundStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [launching, setLaunching] = useState<RoundMode | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/fl/round", { cache: "no-store" }).catch(() => null);
    if (!res) {
      setError("Console server not answering.");
      return;
    }
    const body = await res.json().catch(() => null);
    if (res.ok && body) {
      setData(body as RoundStateResponse);
      setError(null);
    } else {
      setError(body?.error ?? `Round state failed (${res.status})`);
    }
  }, []);

  const busy = Boolean(data?.job.running) || Boolean(data?.nodes.some((node) => node.running));

  useEffect(() => {
    const tick = () => {
      void load();
    };
    tick();
    const timer = setInterval(tick, busy || launching ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => clearInterval(timer);
  }, [load, busy, launching]);

  const launch = async (mode: RoundMode) => {
    setConfirming(false);
    setLaunching(mode);
    const res = await fetch("/api/fl/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) setError(body?.error ?? "Could not open the Git Bash window.");
    await load();
    setTimeout(() => setLaunching(null), 6_000);
  };

  const min = data?.minLabels ?? 20;
  const ready = Boolean(data?.nodes.every((node) => node.online && (node.reviewed ?? 0) >= min));
  const locked = busy || launching !== null || !data?.canLaunch;
  const job = data?.job.running ?? data?.job.last ?? null;

  return (
    <section className="rounded border border-border bg-surface p-4 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-sm font-medium text-foreground">Federated round</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={locked}
            onClick={() => void launch("check")}
            className={`${BUTTON} border-border bg-surface-raised text-foreground hover:border-accent`}
          >
            Check labels
          </button>
          {confirming ? (
            <>
              <span className="text-foreground">
                Start a real round on every node{ready ? "" : " (not all nodes have enough labels)"}?
              </span>
              <button
                type="button"
                disabled={locked}
                onClick={() => void launch("round")}
                className={`${BUTTON} border-danger bg-danger/15 text-danger`}
              >
                Yes, start round
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={`${BUTTON} border-border text-muted`}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={locked}
              onClick={() => setConfirming(true)}
              className={`${BUTTON} border-accent/60 bg-surface-raised text-foreground hover:border-accent`}
            >
              Run federated round
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted">
        Same as <code>bash ~/ARGUS/run-round.sh</code>: human-reviewed labels only, {min} per node,
        aggregator {data?.aggregator.address ?? "on Node C"}. The buttons open a Git Bash window on this PC.
        {data && !data.canLaunch && " They work only from the console PC (localhost)."}
      </p>

      {error && <p className="mt-2 text-danger">{error}</p>}

      {data && (
        <>
          <p className="mt-2">
            {data.job.running ? (
              <span style={{ color: AMBER }}>
                ● {data.job.running.mode === "round" ? "Round" : "Label check"} running in the Git Bash window
                (since {new Date(data.job.running.startedAt).toLocaleTimeString()})
              </span>
            ) : busy ? (
              <span style={{ color: AMBER }}>● A node reports a round running</span>
            ) : launching ? (
              <span style={{ color: AMBER }}>● Opening the Git Bash window…</span>
            ) : ready ? (
              <span className="text-accent">✓ Every node has {min}+ human labels. Ready when Gio says go.</span>
            ) : (
              <span className="text-danger">✕ Not every node is online with {min}+ human labels.</span>
            )}
            <span className="text-muted">
              {" "}· Aggregator {data.aggregator.address}:{" "}
              {data.aggregator.listening ? (
                <span className="text-accent">listening</span>
              ) : (
                "not running (the round starts it)"
              )}
              {" "}· read {formatEpoch(data.checkedAt)}
            </span>
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left tabular-nums">
              <thead>
                <tr>
                  <th className={TH}>Node</th>
                  <th className={TH}>Human labels</th>
                  <th className={TH}>Model</th>
                  <th className={TH}>Round</th>
                  <th className={TH}>Last round result</th>
                </tr>
              </thead>
              <tbody>
                {data.nodes.map((node) => (
                  <tr key={node.id} className="border-t border-border">
                    <td className={TD}>{node.name}</td>
                    <td className={TD}>
                      {node.online ? (
                        <span className={(node.reviewed ?? 0) >= min ? "text-accent" : "text-danger"}>
                          {node.reviewed ?? "?"} / {min}
                        </span>
                      ) : (
                        <span className="text-danger">✕ {node.error ?? "offline"}</span>
                      )}
                      {node.labelled !== null && node.labelled !== node.reviewed && (
                        <span className="text-muted"> ({node.labelled} labelled)</span>
                      )}
                    </td>
                    <td className={TD}>{node.modelVersion ?? "unknown"}</td>
                    <td className={TD}>
                      {node.running ? (
                        <span style={{ color: AMBER }}>running</span>
                      ) : node.lastStarted ? (
                        <span className="text-muted">
                          idle · last {formatEpoch(node.lastStarted)}
                          {node.lastExitCode !== null && ` · exit ${node.lastExitCode}`}
                        </span>
                      ) : (
                        <span className="text-muted">idle</span>
                      )}
                    </td>
                    <td className={TD}>
                      <LastRound node={node} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {job && (
            <div className="mt-3 border-t border-border pt-2">
              <p className="text-muted">
                {data.job.running ? "Running" : "Last"} {job.mode === "round" ? "round" : "label check"} from this
                console: started {new Date(job.startedAt).toLocaleString()}
                {job.finishedAt && (
                  <>
                    , finished {new Date(job.finishedAt).toLocaleTimeString()},{" "}
                    <span className={job.exitCode === 0 ? "text-accent" : "text-danger"}>
                      exit {job.exitCode}
                    </span>
                  </>
                )}
                {job.log && <> · log {job.log}</>}
              </p>
              {data.job.tail.length > 0 && (
                <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-[11px] text-muted">
                  {data.job.tail.join("\n")}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
