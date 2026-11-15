import type { GateResult } from "@/lib/fl/types";

// The federated round that ~/ARGUS/run-round.sh runs: human_only labels,
// at least ROUND_MIN_LABELS of them on every node, aggregator on Node C.
// (The 200 in MIN_LABELS_PER_NODE is the pre-flight's bar for a round that
// counts as evidence; this is the script's bar for a round that runs.)
export const ROUND_MIN_LABELS = 20;

export type RoundMode = "round" | "check";

export interface RoundNodeState {
  id: string;
  name: string;
  online: boolean;
  error?: string;
  modelVersion?: string;
  /** Human-reviewed labels, the ones human_only training uses. */
  reviewed: number | null;
  labelled: number | null;
  running: boolean | null;
  /** When the node's last round started (unix seconds). */
  lastStarted: number | null;
  lastExitCode: number | null;
  lastResult: GateResult | null;
}

export interface RoundJob {
  mode: RoundMode;
  stamp: string;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  log?: string;
}

export interface RoundStateResponse {
  checkedAt: number;
  minLabels: number;
  nodes: RoundNodeState[];
  aggregator: { address: string; listening: boolean };
  job: {
    running: RoundJob | null;
    last: RoundJob | null;
    /** Last lines of the last job's log. */
    tail: string[];
  };
  /** True only when the browser is on this PC, where the window would open. */
  canLaunch: boolean;
}
