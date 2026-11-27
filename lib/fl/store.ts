import { promises as fs } from "fs";
import path from "path";
import type { HistoryFile, OperatorNote } from "@/lib/fl/types";

// Disk store for the federated page. Server-only.
//
// The aggregator keeps its round history in memory and a node keeps only
// its latest round, so a restart on either side erases the evidence. The
// console copies each result here the moment it sees one, and this is the
// copy that lasts. ARGUS_FL_DATA_DIR moves it; tests point it elsewhere so
// fixtures can never land in the real history.

export function dataDir(): string {
  return (
    process.env.ARGUS_FL_DATA_DIR ?? path.join(process.cwd(), "data", "federated")
  );
}

const historyPath = () => path.join(dataDir(), "history.json");
const notesPath = () => path.join(dataDir(), "operator-notes.jsonl");

const EMPTY: HistoryFile = { version: 1, runs: [], measurements: [], testSets: {} };

/**
 * One writer at a time within this server process. Held on globalThis: the
 * background saver and the API routes can load separate copies of this module,
 * and two locks would let one save overwrite the other.
 */
const shared = globalThis as unknown as { __argusFlTail?: Promise<unknown> };
export function serialized<T>(work: () => Promise<T>): Promise<T> {
  const next = (shared.__argusFlTail ?? Promise.resolve()).then(work, work);
  shared.__argusFlTail = next.catch(() => undefined);
  return next;
}

/** The history in a file; null if it is missing. Throws if it is damaged. */
async function parseHistory(file: string): Promise<HistoryFile | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const parsed = JSON.parse(raw) as HistoryFile;
  if (!Array.isArray(parsed?.runs)) throw new Error("not a history file");
  return { ...structuredClone(EMPTY), ...parsed };
}

/**
 * A damaged or vanished file falls back to the previous save. If neither can
 * be read this throws rather than reading as empty: reading it as empty would
 * overwrite the history on the next save.
 */
export async function readHistory(): Promise<HistoryFile> {
  const target = historyPath();
  let damaged: unknown;
  try {
    const current = await parseHistory(target);
    if (current) return current;
  } catch (err) {
    damaged = err;
  }

  const backup = await parseHistory(`${target}.bak`).catch(() => null);
  if (backup) {
    // Set the damaged file aside, so it is kept and never copied over .bak.
    if (damaged) {
      await fs.rename(target, `${target}.damaged-${Date.now()}`).catch(() => undefined);
    }
    return backup;
  }
  if (damaged) throw damaged;
  return structuredClone(EMPTY);
}

let writes = 0;

export async function writeHistory(history: HistoryFile): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const target = historyPath();
  const temp = `${target}.${process.pid}-${++writes}.tmp`;
  const handle = await fs.open(temp, "w");
  try {
    await handle.writeFile(JSON.stringify(history, null, 2), "utf8");
    // On disk before it replaces anything: a crash must not leave zeros.
    await handle.sync();
  } finally {
    await handle.close();
  }
  // Only a readable file may become the backup.
  if (await parseHistory(target).catch(() => null)) {
    await fs.copyFile(target, `${target}.bak`);
  }
  await fs.rename(temp, target);
}

export async function readNotes(node?: string): Promise<OperatorNote[]> {
  let raw: string;
  try {
    raw = await fs.readFile(notesPath(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const notes: OperatorNote[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      notes.push(JSON.parse(line) as OperatorNote);
    } catch {
      // A torn last line after a hard stop; the rest is still good.
    }
  }
  return node ? notes.filter((note) => note.node === node) : notes;
}

export async function appendNote(note: OperatorNote): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.appendFile(notesPath(), `${JSON.stringify(note)}\n`, "utf8");
}

/** The note in force for each event: the latest, unless it was cleared. */
export function latestNotes(notes: OperatorNote[]): Map<number, OperatorNote> {
  const latest = new Map<number, OperatorNote>();
  for (const note of notes) {
    if (note.kind === "cleared") latest.delete(note.n);
    else latest.set(note.n, note);
  }
  return latest;
}
