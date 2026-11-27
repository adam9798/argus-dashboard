// Adds a node's older training rounds to the dashboard's history.
//
//   node scripts/import-fl-rounds.mjs <bundle.json> [more.json ...]
//
// The bundle comes from scripts/collect-fl-rounds.py. Safe to run twice: a
// round already saved is not duplicated and nothing known is erased. Stop the
// dashboard first, so the two never write the file at once. The history goes to
// data/federated, or ARGUS_FL_DATA_DIR. Needs Node 22.18 or newer.

import { readFileSync } from "node:fs";
import { parseLog, saveNodeRun } from "../lib/fl/merge.ts";
import { dataDir, readHistory, writeHistory } from "../lib/fl/store.ts";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/import-fl-rounds.mjs <bundle.json> [...]");
  process.exit(1);
}

/** The dashboard's id for a node name, as in lib/nodes.ts. */
const idFor = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const history = await readHistory();
let changed = 0;

for (const file of files) {
  const bundle = JSON.parse(readFileSync(file, "utf8"));
  const name = String(bundle.node ?? "").trim();
  if (!idFor(name)) throw new Error(`${file}: the bundle names no node`);

  const rounds = (bundle.rounds ?? [])
    .map((round) => ({ ...round, parsed: parseLog(round.lines ?? []) }))
    .sort((a, b) => (a.parsed.readyAt ?? 0) - (b.parsed.readyAt ?? 0));

  for (const { runDir, parsed } of rounds) {
    if (!parsed.readyAt) {
      console.warn(`${name}: skipped ${runDir}, it never reported starting`);
      continue;
    }
    const decision = (bundle.decisions ?? []).find((item) => item.run_dir === runDir) ?? null;
    const saved = saveNodeRun(history, {
      nodeId: idFor(name),
      nodeName: name,
      reportedName: name,
      started: parsed.readyAt,
      runDir,
      running: false,
      exitCode: parsed.done ? 0 : null,
      trainSamples: parsed.trainSamples,
      valSamples: parsed.valSamples,
      humanOnly: parsed.humanOnly,
      labelsReviewed: parsed.labelsReviewed,
      labelsMachine: parsed.labelsMachine,
      fits: parsed.fits,
      globals: parsed.globals,
      result: decision,
      imported: true,
      capturedAt: Date.now() / 1000,
    });
    if (saved) changed += 1;
    const outcome = decision ? (decision.accepted ? "accepted" : "rejected") : "no decision";
    console.log(`${name}  ${runDir.split("/").pop()}  ${outcome}${saved ? "" : "  (already saved)"}`);
  }
}

if (changed > 0) await writeHistory(history);
console.log(`${changed} round(s) added or updated in ${dataDir()}`);
