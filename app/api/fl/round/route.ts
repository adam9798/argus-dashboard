import { spawn } from "child_process";
import { promises as fs } from "fs";
import { createConnection } from "net";
import os from "os";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getJson } from "@/lib/fl/capture";
import {
  ROUND_MIN_LABELS,
  type RoundJob,
  type RoundNodeState,
  type RoundStateResponse,
} from "@/lib/fl/round";
import type { GateResult, SampleStats } from "@/lib/fl/types";
import { hasDashboardSession } from "@/lib/nodeSessions";
import { configuredNodes, type NodeConfig } from "@/lib/nodes";

// Federated round state, and the "Run federated round" / "Check labels"
// buttons. POST opens a visible Git Bash (mintty) window on THIS PC running
// ~/ARGUS/run-round-console.sh, which runs ~/ARGUS/run-round.sh and writes
// ~/ARGUS/logs/round-last.json for GET to read. POST only from the PC itself.

export const dynamic = "force-dynamic";

const ARGUS_DIR = process.env.ARGUS_ROUND_DIR ?? path.join(os.homedir(), "ARGUS");
const LOG_DIR = path.join(ARGUS_DIR, "logs");
/** Forward slashes: Git Bash reads C:/... paths. Not ~, the server's HOME differs. */
const WRAPPER = path.join(ARGUS_DIR, "run-round-console.sh").split(path.sep).join("/");
const MINTTY = process.env.ARGUS_MINTTY ?? "C:\\Program Files\\Git\\usr\\bin\\mintty.exe";
const AGGREGATOR = process.env.ARGUS_FL_AGGREGATOR ?? "10.0.0.139:8080";
/** A marker older than this is a window that was killed, not a running job. */
const STALE_JOB_MS = 20 * 60_000;
/** Covers the second between spawning the window and the script's marker. */
const LAUNCH_GRACE_MS = 15_000;
const TAIL_LINES = 14;

let launchedAt = 0;

interface NodeRoundBody {
  running: boolean;
  exit_code: number | null;
  started: number | null;
  result: GateResult | null;
}

interface StatusBody {
  model_version?: string;
  samples?: SampleStats | null;
}

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+|localhost)$/;

function hostName(host: string | null): string {
  if (!host) return "";
  return host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
}

/**
 * Next fills x-forwarded-for from the socket only when the client did not
 * send one, so this is defence in depth next to the sign-in and Origin checks.
 */
function isLocalRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return LOOPBACK.test(hostName(request.headers.get("host"))) && LOOPBACK.test(forwarded);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function runningJob(): Promise<RoundJob | null> {
  const job = await readJson<RoundJob>(path.join(LOG_DIR, "round-running.json"));
  if (!job) return null;
  const age = Date.now() - Date.parse(job.startedAt);
  return Number.isFinite(age) && age < STALE_JOB_MS ? job : null;
}

async function logTail(job: RoundJob | null): Promise<string[]> {
  if (!job) return [];
  try {
    const text = await fs.readFile(path.join(LOG_DIR, `round-${job.stamp}.log`), "utf8");
    const lines = text.replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/).filter(Boolean);
    return lines.slice(-TAIL_LINES).map((line) => line.slice(0, 220));
  } catch {
    return [];
  }
}

function aggregatorListening(): Promise<boolean> {
  const [host, port] = AGGREGATOR.split(":");
  return new Promise((resolve) => {
    const socket = createConnection({ host, port: Number(port), timeout: 2_000 });
    const done = (up: boolean) => {
      socket.destroy();
      resolve(up);
    };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function readNode(node: NodeConfig): Promise<RoundNodeState> {
  const [status, round] = await Promise.all([
    getJson<StatusBody>(`${node.baseUrl}/api/status`, node, 6_000),
    getJson<NodeRoundBody>(`${node.baseUrl}/api/federated/round`, node, 6_000),
  ]);
  const samples = status.data?.samples;
  return {
    id: node.id,
    name: node.name,
    online: status.ok,
    error: status.ok ? undefined : status.error,
    modelVersion: status.data?.model_version,
    reviewed: samples?.provenance?.reviewed ?? null,
    labelled: samples?.labelled ?? null,
    running: round.data?.running ?? null,
    lastStarted: round.data?.started ?? null,
    lastExitCode: round.data?.exit_code ?? null,
    lastResult: round.data?.result ?? null,
  };
}

/** The dashboard's one sign-in (lib/dashboardSession.ts), checked again here. */
async function hasSession(): Promise<boolean> {
  return hasDashboardSession();
}

export async function GET(request: NextRequest) {
  if (!(await hasSession())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const [nodes, listening, running, last] = await Promise.all([
    Promise.all(configuredNodes().map((node) => readNode(node))),
    aggregatorListening(),
    runningJob(),
    readJson<RoundJob>(path.join(LOG_DIR, "round-last.json")),
  ]);
  const body: RoundStateResponse = {
    checkedAt: Date.now() / 1000,
    minLabels: ROUND_MIN_LABELS,
    nodes,
    aggregator: { address: AGGREGATOR, listening },
    job: { running, last, tail: await logTail(running ?? last) },
    canLaunch: isLocalRequest(request),
  };
  return NextResponse.json(body);
}

function stampNow(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
}

function refuse(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) return refuse(403, "Only from the console PC (localhost).");
  if (!sameOrigin(request)) return refuse(403, "Bad origin.");
  if (!(await hasSession())) return refuse(401, "Not authenticated");

  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  const mode = body?.mode;
  if (mode !== "round" && mode !== "check") return refuse(400, "mode must be round or check");

  if (Date.now() - launchedAt < LAUNCH_GRACE_MS || (await runningJob())) {
    return refuse(409, "A round or check window is already running.");
  }
  if (mode === "round") {
    const nodes = await Promise.all(configuredNodes().map((node) => readNode(node)));
    if (nodes.some((node) => node.running)) {
      return refuse(409, "A node reports a round already running.");
    }
  }

  launchedAt = Date.now();
  const stamp = stampNow();
  const title = mode === "round" ? "ARGUS federated round" : "ARGUS label check";
  try {
    // mode and stamp are fixed shapes (enum, digits), so the command line is safe.
    const child = spawn(
      MINTTY,
      ["-t", title, "-e", "/usr/bin/bash", "-l", "-c", `bash "${WRAPPER}" ${mode} ${stamp}`],
      { detached: true, stdio: "ignore", windowsHide: false },
    );
    child.once("error", (err) => console.error("[fl/round] window failed:", err.message));
    child.unref();
  } catch (err) {
    launchedAt = 0;
    return refuse(500, `Could not open Git Bash: ${err instanceof Error ? err.message : String(err)}`);
  }
  return NextResponse.json({ ok: true, mode, stamp });
}
