# ARGUS handover (2026-11-14, before the EGN2 demo on Sun 11-15)

For a teammate or a fresh agent picking this up. No passwords, tokens or keys
live in this file. They are in `.env.local` (git-ignored) and on the nodes.

Facts are marked:
- **[verified]**: checked in code, or tested on 2026-11-14 (merge report:
  `C:\Users\colab\prometheus_workspace\argus-swipe\CONSOLE-MERGE-2026-11-14.md`).
- **[reported]**: from the 11-13/11-14 reports or from Gio. Not re-checked on
  the nodes for this file.

---

## 1. Console (this repo)

### What master contains [verified]
- **One dashboard login.** `DASHBOARD_USER` / `DASHBOARD_PASSWORD` →
  signed HttpOnly `argus_session` cookie (`lib/dashboardSession.ts`).
  `proxy.ts` gates every page and `/api` route.
- **The server signs in to the nodes itself** (`lib/nodeAuth.ts`):
  - It checks `GET /api/auth/me`, logs in with `ARGUS_NODE_USER` / `ARGUS_NODE_PASSWORD`
    (or `ARGUS_NODE_CREDS`), and re-logs in on a 401.
  - The browser never sees node tokens.
  - If a node rejects the login, its panel says so (`components/NodeAuthNotice.tsx`).
- **Pages** (tab bar picks the node for the single-node pages):
  - `/dashboard`: side-by-side console, all nodes, staging-mode buttons.
  - `/dashboard/nodes`: All nodes overview, stills plus status.
  - `/dashboard/live`: live feed with **event playback**. `?event=<id>` opens an
    event; the clip plays, or the still with "No clip saved"; the stream pauses
    while it is open; "Back to live" reopens it.
  - `/dashboard/alerts`, `/dashboard/thermal`.
  - `/dashboard/label`: labeling screen and review queue (machine suggestions,
    label provenance, held-back test set).
  - `/dashboard/swipe`: swipe labeling game with an active-learning order
    (model-uncertain first), staging mode and auto-label preview.
  - `/dashboard/federated`: federated progress (pre-flight, trend, run history)
    plus the **Federated round** panel (below).
- **Node proxy** `app/api/argus/[...path]`: allowlisted paths only, with
  `?node=<id>` (an id from `ARGUS_NODES`). It cannot start a round or
  bootstrap synthetic data.

### Federated round panel [verified]
- `app/api/fl/round/route.ts`. GET returns the state. POST `{mode:"round"|"check"}`.
- The POST is refused unless **all** of these hold:
  - the request comes from localhost;
  - `Origin` is same-origin;
  - there is a valid dashboard session;
  - no job is running and the last launch was more than 15 s ago;
  - for `round`, no node reports a round running.
- **Check labels** / **Run federated round** open a visible Git Bash (mintty)
  window on this PC running `C:\Users\colab\ARGUS\run-round-console.sh`, which
  runs `run-round.sh`.
- Logs go to `C:\Users\colab\ARGUS\logs\round-<stamp>.log`.
  `logs\round-last.json` holds the last job (mode, start and finish, exitCode,
  log path). `logs\round-running.json` exists while a job runs.
- On success the window closes after a few seconds; on failure it waits for a key.
- The window can open behind Chrome. Look in the taskbar.

### How to run it [verified]
```
cd C:\Users\colab\Documents\argus-dashboard
npx next dev -p 3004 > %TEMP%\argus-console-3004.log 2>&1
```
Open http://localhost:3004 and sign in with the dashboard login from `.env.local`.

`.env.local` keys (values not shown):
- `ARGUS_NODES`: `Camera 1|Node A=http://10.0.0.140:8000,Camera 2|Node B=http://10.0.0.129:8000,Camera 3|Node C=http://10.0.0.139:8000`.
  The label before `|` is what the console shows. The node id comes from the
  name after it (`node-a`, ...).
- `DASHBOARD_USER`, `DASHBOARD_PASSWORD`, `DASHBOARD_SESSION_SECRET` (32+ chars).
- `ARGUS_NODE_USER`, `ARGUS_NODE_PASSWORD` (or `ARGUS_NODE_CREDS="Node B=user:pass,..."`).
- Optional: `ARGUS_FL_DATA_DIR`, `ARGUS_SWIPE_DATA_DIR` (default
  `data/federated` and `data/swipe` under the working folder),
  `ARGUS_ROUND_DIR` (default `~/ARGUS`), `ARGUS_FL_AGGREGATOR` (default
  `10.0.0.139:8080`), `ARGUS_FLOWER_API`.

**Console data** (test set, operator notes, swipe ledger and streak) lives in
`data/` (git-ignored). It was moved from `argus-console-swipe\data` at the
switch and migrated to the new node ids with
`node scripts/migrate-console-node-ids.mjs <data dir>`. The script is
idempotent and makes `.bak-ids-*` backups.

### Roll back
- **Code:** `git checkout a7cbe46` is master before the merge (single login +
  playback, no console line). The old console line is `feat/fl-button-compact`
  8ba2f24, still in the `argus-console-swipe` worktree.
- **Old live console:**
  1. Stop :3004.
  2. `cd C:\Users\colab\Documents\argus-console-swipe` and
     `npx next dev -p 3004 > %TEMP%\argus-console-3004.log 2>&1`.
  3. That worktree's `data\` still holds the pre-switch data under the old
     `camera-N-node-x` ids. It uses per-node sign-in with node passwords.

---

## 2. Federated round script [verified from `C:\Users\colab\ARGUS\run-round.sh`]
- Nodes: `A=viccia@10.0.0.140`, `B=viccia@10.0.0.129`, `C=argus3@10.0.0.139`.
- SSH key: `C:\Users\colab\.ssh\id_ed25519_argus`.
- Settings: `MIN=20` human-reviewed labels per node, `EPOCHS=6`, `human_only: true`.
  These can be overridden from the environment.
- `bash ~/ARGUS/run-round.sh --check` prints the label counts and exits 0.
- A full run:
  1. starts the aggregator on **Node C :8080** (`sim/fl.py serve --rounds 1 --clients 3`);
  2. asks each node to join;
  3. waits up to 10 min.
- Exit codes:

  | Code | Meaning |
  |---|---|
  | 0 | ok |
  | 1 | the aggregator did not start |
  | 3 | a node did not join |
  | 4 | still running after 10 min (the round keeps going) |

  A `RESULT:` line is printed at the end.
- Backup of the earlier script: `run-round.sh.bak-20261114`.
- Last results (11-14): all 3 nodes **rejected** the candidate. Anomaly recall
  was 0.0, below the 0.5 floor. That is the gate working, not an error.
- **Hotspot day (IPs change):** set the node IPs in three places:
  1. `ARGUS_NODES` in `.env.local`;
  2. the `A=` / `B=` / `C=` lines of `run-round.sh`;
  3. `ARGUS_FL_AGGREGATOR` (or the default `10.0.0.139:8080`) if C's IP changes.

  Then restart the console. Hotspot addresses are `172.20.10.x`; the hotspot
  laptop is `172.20.10.6`.

---

## 3. Nodes
| Node | SSH | Start / autostart | Notes |
|---|---|---|---|
| A (Camera 1) | `viccia@10.0.0.140` | `~/start-argus.sh`, cron `@reboot` `argus-boot.sh` | CPU + Logitech C310, model fl-r1 |
| B (Camera 2) | `viccia@10.0.0.129` | `~/start-argus.sh`, cron `@reboot` `argus-boot.sh` | Hailo-10H, model untrained, **SD card failing** |
| C (Camera 3) | `argus3@10.0.0.139` | systemd `argus-node.service` (enabled) | Hailo-10H ~30 fps, fl-r1, the demo node of record |

- **[verified 11-14 via the console]** All 3 are online and streaming, and all
  report `auth_required: false` (open).
- **[reported]** All 3 run `deploy/demo-2026-11-13` **9d3c92f** (swipe code
  plus the USB-camera MJPG fix). The threat stage is on.
- **[reported]** `deploy/node.env` on each node:
  - `FL_HUMAN_ONLY=true`, `FL_MIN_SAMPLES=20`;
  - `RECORD_MAX_GB=1`, `CLOUD_QUEUE_MAX_MB=500` (backups `node.env.bak-20261114`);
  - `CLOUD_URL` points at the hotspot laptop.
- **[reported]** Daily compaction:
  - cron `30 3 * * *` plus `@reboot sleep 90` runs `~/bin/argus-compact.sh`. It
    clears the pip cache, runs `argus-retention.py`, VACUUMs the DB if needed,
    and logs to `~/argus-compact.log`.
  - Retention deletes clips, cloud-queue items and unlabelled snapshots after
    **2 days**. At or above **50%** disk it deletes oldest-first down to
    **40%**.
  - It never touches `data/training`, DB rows or labelled files. Sources are in
    `deploy/compact/` of the node repo.
- **[reported]** Data was cleared 11-14. Backups are in
  `C:\Users\colab\prometheus_workspace\argus-backups\2026-11-14-pre-clear` (that
  folder exists).
- **[reported]** Disk now: A 29%, B 45%, C 60%.
- **[reported]** Node dashboard/admin password reset: `scripts/set_password.py`
  in the node repo.
- **B:** the ext4 checksum errors and corrupt `/etc/sudoers` mean there is no
  root and no systemd. It runs on a rebuilt venv. The old venv is
  `~/argus/.venv.corrupt-20261114`.
  - Don't reboot B before the demo.
  - Replace the card with a high-endurance one after the demo.
  - Setup steps: `prometheus_workspace\argus-swipe\BC-REFLASH-2026-11-14.md`.
- **One-node fallback:** Node C alone. Set `ARGUS_NODES=Camera 3|Node C=http://<C-ip>:8000`.
  Don't run a 1-client round live; show the stills instead.

---

## 4. Known issues and next steps
- Remotes: `viccia` = VICCIAAI/argus-dashboard (the one to push to, with
  Gio's OK); `origin` = adam9798, which this PC has no push access to. The
  merge report lists what was pushed.
- Gate B security fixes (`fix/gate-b` in the node repo) are **not** in 9d3c92f.
  Merge them before any auth-on or showcase use (target 11-22). Also:
  `AUTH_REQUIRED=true` plus a 12+ character admin password on the nodes before
  any tunnel.
- The thermal routes are not on the node's auth allowlist
  (`test_router_auth` known failure).
- `next build` warns that the `spawn` in `app/api/fl/round/route.ts` makes
  Turbopack trace the whole project. This is harmless for a local console.
- The old "re-swipe event #2198 on Node C" item is moot. C's data was cleared
  on 11-14 and its events restart from #1.
- 11-14 test label: Node C event #69 = `routine_vehicle`, reviewer "Claude
  test" (from the merge check). Undo it from the swipe page if unwanted.
- Lab suite (`argus-lab`, `lab/identity-and-signup`) has 28/41 files run.
  Finish it when the PC is idle.
- Dashboard cleanup ideas are listed in the merge report. None have been built.
