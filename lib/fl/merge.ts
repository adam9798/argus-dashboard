import type {
  FitLog,
  GlobalLog,
  HistoryFile,
  NodeRun,
  RunRecord,
} from "@/lib/fl/types";

// The rules for folding what a node reports into the saved history. Pure, and
// free of runtime imports, so the server, the federated page and the import
// script all share them.

/** Two nodes' rounds starting this close together are one federated run. */
export const JOIN_WINDOW_S = 10 * 60;

export interface ParsedLog {
  fits: FitLog[];
  globals: GlobalLog[];
  trainSamples?: number;
  valSamples?: number;
  humanOnly?: boolean;
  labelsReviewed?: number;
  labelsMachine?: number;
  /** When the client reported ready, in epoch seconds. */
  readyAt?: number;
  done: boolean;
}

/** Reads the round client's JSON lines; anything else in the log is ignored. */
export function parseLog(log: string[]): ParsedLog {
  const parsed: ParsedLog = { fits: [], globals: [], done: false };
  for (const line of log) {
    if (!line.startsWith("{")) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.kind === "ready") {
        parsed.trainSamples = entry.train;
        parsed.valSamples = entry.val;
        parsed.humanOnly = entry.human_only;
        parsed.labelsReviewed = entry.labels_reviewed;
        parsed.labelsMachine = entry.labels_machine;
        parsed.readyAt = entry.t;
      } else if (entry.kind === "fit") parsed.fits.push(entry);
      else if (entry.kind === "global") parsed.globals.push(entry);
      else if (entry.kind === "done") parsed.done = true;
    } catch {
      // Flower's own log lines are mixed in; only ours are JSON.
    }
  }
  return parsed;
}

/**
 * Joins two lists by round number. A node only sends the tail of a long log,
 * so a later read must add to what was saved, never replace it.
 */
function byRound<T extends { round: number }>(saved: T[], incoming: T[]): T[] {
  const rounds = new Map(saved.map((item) => [item.round, item]));
  for (const item of incoming) rounds.set(item.round, item);
  return [...rounds.values()].sort((a, b) => a.round - b.round);
}

/** A newer reading of one node's round. Nothing known is ever erased. */
export function mergeNodeRun(saved: NodeRun, incoming: NodeRun): NodeRun {
  const known = Object.fromEntries(
    Object.entries(incoming).filter(([, value]) => value !== undefined && value !== null),
  ) as Partial<NodeRun>;
  const merged: NodeRun = {
    ...saved,
    ...known,
    started: saved.started,
    running: incoming.running,
    fits: byRound(saved.fits, incoming.fits),
    globals: byRound(saved.globals, incoming.globals),
    result: incoming.result ?? saved.result,
    exitCode: incoming.exitCode ?? saved.exitCode,
    capturedAt: saved.capturedAt,
  };
  // Seen running again, or decided after all: it was not interrupted.
  if (merged.running || merged.result) delete merged.interrupted;
  return merged;
}

/** Comparable form of a record, whatever order its keys were set in. */
function canonical(run: NodeRun): string {
  return JSON.stringify(
    Object.entries({ ...run, capturedAt: 0 })
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function runIdFor(startedSeconds: number): string {
  const iso = new Date(startedSeconds * 1000).toISOString();
  return `run-${iso.slice(0, 19).replace(/[-:]/g, "").replace("T", "-")}`;
}

export function addRun(history: HistoryFile, started: number): RunRecord {
  let id = runIdFor(started);
  while (history.runs.some((run) => run.id === id)) id += "-b";
  const run: RunRecord = { id, startedAt: started, nodes: [], serverRounds: [] };
  history.runs.push(run);
  history.runs.sort((a, b) => a.startedAt - b.startedAt);
  return run;
}

/**
 * Saves one node's round. The same round (node and folder) is updated where it
 * is. A new one joins the nearest run that started within the window and does
 * not already hold this node: two rounds from one node are never one run.
 * Returns true when the history changed.
 */
export function saveNodeRun(history: HistoryFile, incoming: NodeRun): boolean {
  for (const run of history.runs) {
    const index = run.nodes.findIndex(
      (item) => item.nodeId === incoming.nodeId && item.runDir === incoming.runDir,
    );
    if (index < 0) continue;
    const merged = mergeNodeRun(run.nodes[index], incoming);
    if (canonical(merged) === canonical(run.nodes[index])) return false;
    run.nodes[index] = merged;
    return true;
  }

  const gap = (run: RunRecord) => Math.abs(run.startedAt - incoming.started);
  const [nearest] = history.runs
    .filter(
      (run) =>
        gap(run) <= JOIN_WINDOW_S &&
        !run.nodes.some((item) => item.nodeId === incoming.nodeId),
    )
    .sort((a, b) => gap(a) - gap(b));
  (nearest ?? addRun(history, incoming.started)).nodes.push(incoming);
  return true;
}

/** A round the node was still working on, as far as the saved record knows. */
function pending(node: NodeRun): boolean {
  return node.running || (!node.result && node.exitCode === 0 && !node.imported);
}

/**
 * Call when a node has answered. A saved round still pending that the node no
 * longer reports was cut off, usually by a restart.
 */
export function markInterrupted(
  history: HistoryFile,
  nodeId: string,
  reportedRunDir: string | null,
): boolean {
  let changed = false;
  for (const run of history.runs) {
    for (const node of run.nodes) {
      if (node.nodeId !== nodeId || node.runDir === reportedRunDir) continue;
      if (!pending(node)) continue;
      node.running = false;
      node.interrupted = true;
      changed = true;
    }
  }
  return changed;
}

export type RoundState =
  | "running"
  | "deciding"
  | "accepted"
  | "rejected"
  | "incomplete"
  | "interrupted";

export function roundState(node: NodeRun): RoundState {
  if (node.running) return "running";
  if (node.result?.accepted) return "accepted";
  // The node files a failed round as "not accepted" with no candidate scored.
  // That is not the gate turning a model down.
  if (node.result?.candidate) return "rejected";
  if (node.interrupted) return "interrupted";
  if (!node.result && pending(node)) return "deciding";
  return "incomplete";
}

/**
 * Nothing shows what the round trained on: it did not record whether labels
 * were reviewed, and synthetic rows were never checked. Shown, but not charted.
 */
export function isUnverified(node: NodeRun): boolean {
  return node.humanOnly === undefined && node.syntheticRows === undefined;
}
