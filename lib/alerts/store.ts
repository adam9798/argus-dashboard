import { promises as fs } from "fs";
import path from "path";

// Disk state for alert delivery. Server-only. ARGUS_ALERTS_DATA_DIR moves it.
// It survives a restart, so the last event each node was checked up to is
// not forgotten and alerts raised while the dashboard was down still go out.

export interface LastAlert {
  at: string;
  node: string;
  eventId: number | null;
  test: boolean;
}

export interface AlertState {
  version: 1;
  /** Strangers already handled per node (sent or deliberately skipped). */
  seen: Record<string, number[]>;
  sent: number;
  failed: number;
  last: LastAlert | null;
  lastError: string | null;
}

export function alertsDir(): string {
  return process.env.ARGUS_ALERTS_DATA_DIR ?? path.join(process.cwd(), "data", "alerts");
}

const statePath = () => path.join(alertsDir(), "state.json");
const deadLetterPath = () => path.join(alertsDir(), "dead-letter.jsonl");

export const EMPTY_STATE: AlertState = {
  version: 1,
  seen: {},
  sent: 0,
  failed: 0,
  last: null,
  lastError: null,
};

let tail: Promise<unknown> = Promise.resolve();
/** One writer at a time within this server process. */
export function serialized<T>(work: () => Promise<T>): Promise<T> {
  const next = tail.then(work, work);
  tail = next.catch(() => undefined);
  return next;
}

/** A file that exists but cannot be parsed throws rather than reading as empty. */
export async function readState(): Promise<AlertState> {
  let raw: string;
  try {
    raw = await fs.readFile(statePath(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return structuredClone(EMPTY_STATE);
    }
    throw err;
  }
  return { ...structuredClone(EMPTY_STATE), ...(JSON.parse(raw) as AlertState) };
}

export async function writeState(state: AlertState): Promise<void> {
  await fs.mkdir(alertsDir(), { recursive: true });
  const target = statePath();
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(temp, target);
}

export interface DeadLetter {
  at: string;
  node: string;
  eventId: number | null;
  error: string;
  payload: unknown;
}

/** An alert that could not be delivered, kept so it is never silently lost. */
export async function appendDeadLetter(entry: DeadLetter): Promise<void> {
  await fs.mkdir(alertsDir(), { recursive: true });
  await fs.appendFile(deadLetterPath(), `${JSON.stringify(entry)}\n`, "utf8");
}
