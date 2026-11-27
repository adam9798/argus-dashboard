"""Print a node's saved training rounds as JSON. Runs ON THE PI, read-only.

    ssh <user>@<node> 'cd argus && python3 -' < scripts/collect-fl-rounds.py > node.json
    node scripts/import-fl-rounds.mjs node.json

The node keeps every round in data/fl_rounds/ and every gate decision in
data/fl_model_state.json, but its API only reports the latest round since it
started. This collects the older ones for the dashboard.
"""

import json
import os


def node_name():
    try:
        with open("deploy/node.env", encoding="utf-8") as f:
            for line in f:
                if line.startswith("NODE_NAME="):
                    return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return os.environ.get("NODE_NAME", "")


def lines_of(path):
    try:
        with open(path, encoding="utf-8") as f:
            return [line.rstrip("\n") for line in f if line.strip()]
    except OSError:
        return []


root = "data/fl_rounds"
rounds = [
    {
        "runDir": os.path.abspath(os.path.join(root, name)),
        "lines": lines_of(os.path.join(root, name, "events.jsonl")),
    }
    for name in sorted(os.listdir(root) if os.path.isdir(root) else [])
]

try:
    with open("data/fl_model_state.json", encoding="utf-8") as f:
        decisions = json.load(f).get("history", [])
except (OSError, ValueError):
    decisions = []

print(json.dumps({"node": node_name(), "rounds": rounds, "decisions": decisions}))
