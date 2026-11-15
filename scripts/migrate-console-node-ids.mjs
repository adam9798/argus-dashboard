#!/usr/bin/env node
// One-time migration of the console's on-disk data (data/federated and
// data/swipe) from the old node ids to the current ones.
//
// The console line (feat/swipe-label .. feat/fl-button-compact) had no
// "label|name" parsing, so with ARGUS_NODES="Camera 1|Node A=..." it used
// the slug of the whole entry ("camera-1-node-a") as the node id. Master
// splits the label off and uses the slug of the node name ("node-a").
// Operator notes, the swipe ledger, staging sessions and the federated
// history are keyed by node id, so they must be rewritten once.
//
// Usage:   node scripts/migrate-console-node-ids.mjs <data dir>
//          (the folder holding federated/ and swipe/; ARGUS_NODES is read
//          from the environment or from .env.local in the current folder)
// Safe to run twice: ids already current are left alone. Every file it
// changes is first copied to <file>.bak-ids-<timestamp>.

import fs from "node:fs";
import path from "node:path";

const dataDir = process.argv[2];
if (!dataDir) {
  console.error("usage: node scripts/migrate-console-node-ids.mjs <data dir>");
  process.exit(2);
}

function readArgusNodes() {
  if (process.env.ARGUS_NODES) return process.env.ARGUS_NODES;
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) return "";
  const line = fs
    .readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("ARGUS_NODES="));
  return line ? line.slice("ARGUS_NODES=".length).replace(/^["']|["']$/g, "") : "";
}

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** old id -> new id, for entries that carry a "label|" prefix. */
function idMap(raw) {
  const map = new Map();
  for (const entry of raw.split(",")) {
    const at = entry.indexOf("=");
    if (at <= 0) continue;
    const full = entry.slice(0, at).trim();
    const bar = full.indexOf("|");
    if (bar === -1) continue;
    const oldId = slug(full);
    const newId = slug(full.slice(bar + 1));
    if (oldId && newId && oldId !== newId) map.set(oldId, newId);
  }
  return map;
}

const map = idMap(readArgusNodes());
if (map.size === 0) {
  console.log("No labelled nodes in ARGUS_NODES: nothing to migrate.");
  process.exit(0);
}
console.log("id map:", Object.fromEntries(map));

const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const remap = (id) => map.get(id) ?? id;

function backupAndWrite(file, text) {
  fs.copyFileSync(file, `${file}.bak-ids-${stamp}`);
  const temp = `${file}.tmp-ids`;
  fs.writeFileSync(temp, text, "utf8");
  fs.renameSync(temp, file);
}

function migrateJsonl(file, key) {
  if (!fs.existsSync(file)) return;
  let changed = 0;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const out = lines.map((line) => {
    if (!line.trim()) return line;
    const row = JSON.parse(line);
    if (map.has(row[key])) {
      row[key] = remap(row[key]);
      changed += 1;
      return JSON.stringify(row);
    }
    return line;
  });
  if (changed) backupAndWrite(file, out.join("\n"));
  console.log(`${path.basename(file)}: ${changed} rows rewritten`);
}

function migrateHistory(file) {
  if (!fs.existsSync(file)) return;
  const history = JSON.parse(fs.readFileSync(file, "utf8"));
  let changed = 0;
  for (const run of history.runs ?? []) {
    const seen = new Set();
    const kept = [];
    for (const node of run.nodes ?? []) {
      if (map.has(node.nodeId)) {
        node.nodeId = remap(node.nodeId);
        changed += 1;
      }
      const key = `${node.nodeId}|${node.runDir}`;
      if (seen.has(key)) {
        changed += 1; // a duplicate the new id would create
        continue;
      }
      seen.add(key);
      kept.push(node);
    }
    run.nodes = kept;
  }
  for (const m of history.measurements ?? []) {
    if (map.has(m.node)) {
      m.node = remap(m.node);
      changed += 1;
    }
  }
  const testSets = {};
  for (const [id, value] of Object.entries(history.testSets ?? {})) {
    if (map.has(id)) changed += 1;
    testSets[remap(id)] = value;
  }
  history.testSets = testSets;
  if (changed) backupAndWrite(file, JSON.stringify(history, null, 2));
  console.log(`${path.basename(file)}: ${changed} ids rewritten or deduped`);
}

function migrateSwipeState(file) {
  if (!fs.existsSync(file)) return;
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  let changed = 0;
  for (const session of state.staging ?? []) {
    if (map.has(session.node)) {
      session.node = remap(session.node);
      changed += 1;
    }
  }
  if (changed) backupAndWrite(file, JSON.stringify(state, null, 2));
  console.log(`${path.basename(file)}: ${changed} staging sessions rewritten`);
}

migrateJsonl(path.join(dataDir, "federated", "operator-notes.jsonl"), "node");
migrateHistory(path.join(dataDir, "federated", "history.json"));
migrateJsonl(path.join(dataDir, "swipe", "ledger.jsonl"), "node");
migrateSwipeState(path.join(dataDir, "swipe", "state.json"));
console.log("done");
