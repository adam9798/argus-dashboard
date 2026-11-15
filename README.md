# ARGUS Dashboard

Frontend for **ARGUS**, a two-node, privacy-preserving AI home security
system (senior design). Each camera is a Raspberry Pi 5 node doing
on-device detection and face recognition; nodes personalize a shared
model via federated learning. No video, face crop, or embedding ever
leaves the property — this dashboard only ever sees the derived event
data (class, zone, confidence, labels), never raw footage.

This repo is the **dashboard, alerting, and event-labeling UI** only —
not the detection pipeline, not federated learning, and not the
backend/API/database (see [Backend contract](#backend-contract) for
what this frontend expects from that backend).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4

## What's here

- **Auth** — one dashboard login (`DASHBOARD_USER` / `DASHBOARD_PASSWORD`)
  → a signed **HttpOnly** session cookie (`lib/dashboardSession.ts`).
  `proxy.ts` checks it on every page and API route; only `/login`,
  `/api/auth/login` and `/api/auth/session` are open. The dashboard
  server then signs in to every node itself (`lib/nodeAuth.ts`): it asks
  each node whether it needs a token (`GET /api/auth/me`), logs in with
  that node's credentials, caches the token, and signs in again on a
  401. Switching cameras never signs you out, and node tokens and
  passwords never reach the browser. Logout ends the dashboard session
  only. When a node turns the server's credentials down, its panel says
  so (fix that node's login in `.env.local`) instead of asking for a
  password.
- **Side-by-side console** (`/dashboard`) — every node in `ARGUS_NODES`
  on one screen, and the landing page after login. Each panel fetches
  and fails on its own and shows:
  - the node's MJPEG camera stream;
  - **status**: FPS, accelerator, model version and SoC temperature,
    with connecting / online / offline / node-login-rejected states;
  - **recent events**, flagging `stranger` detections in red. Clicking
    one opens the shared detail panel as an overlay, with **Confirm
    unusual** / **Label** wired to `POST /api/events/{id}/label` on that
    node, and "Back to live view" (or Esc) closes it while the streams
    keep running.
- **Live feed** (`/dashboard/live`) — the node's MJPEG camera stream
  (`GET /api/camera/stream`) beside the last few detections, so you can
  watch a detection happen and label it in the same view. The camera
  panel has its own connecting / streaming / no-signal states and a
  retry, since the stream fails independently of the rest of the page.
- **Alerts feed** (`/dashboard/alerts`) — only what the node flagged
  (`status: "stranger"`, the head's "unusual for this site" call).
  Unreviewed alerts sort above reviewed ones whatever their timestamp,
  with the event's stored still (`GET /api/events/{id}/snapshot`) when
  the node kept one, and the same Confirm / Correct actions. A badge in
  the nav carries the unreviewed count across all three pages.
- **Live push** — `connectEventsSocket()` is now actually called (see
  `hooks/useEventFeed.ts`): events arrive on `WS /ws/events`, and a
  socket that never opens or dies falls back to polling `/api/events`
  every 5s. The mode badge says which is in effect — "live push" is
  never shown for a poll.
- **Nodes** — a tab bar in the nav (A, B, C, ...) picks which node the
  single-node pages (Live, Alerts, Thermal) show. **All nodes**
  (`/dashboard/nodes`) shows every node from `ARGUS_NODES` at once: a
  camera still refreshed every 3 s when the node's camera is running, and
  its status (online/offline, FPS, backend, model, sample count) either
  way. Offline and camera-less nodes get their own card. Data comes from
  `GET /api/nodes/overview` (each node's `/api/status` +
  `/api/camera/status`, asked in parallel server-side with a 2.5 s
  timeout) and `GET /api/nodes/{id}/snapshot`. Stills, not one MJPEG
  stream per card: browsers allow ~6 open connections per origin, which
  a grid of streams would use up.
- **Authenticated proxy** (`app/api/argus/[...path]/route.ts`) — node
  tokens live only in the dashboard server, so the browser cannot call a
  node that has `AUTH_REQUIRED=true` directly. Browser calls go to
  `/api/argus/<suffix>` on this origin; the route adds the node's
  `Authorization: Bearer` token (from `lib/nodeAuth.ts`) on the way
  out. `?node=<id>` picks the node (an id from `ARGUS_NODES`, never a
  URL); without it, the node picked in the nav is used. Allowlisted
  paths only —
  status, events, labels, event stills, camera stream/snapshot — and
  it's what makes an `<img>` able to show an authenticated MJPEG stream
  at all.
- **Label events** (`/dashboard/label`) — per-node queue of unlabelled real
  events with their stills. Routine or Anomaly in one tap or key (R, A, 1 to
  4 for the class, S skip, X no object, U undo), plus a bulk view that only
  arms once every picture has rendered. A label waits 6 s on the console
  before it goes to the node, because the node cannot clear one. Labels
  are sent as `correct` with an exact label name, and the node's reply is
  checked. A separate **test set** stays on the console, is never sent to
  the node, and is frozen to measure each model.
- **Federated** (`/dashboard/federated`) — pre-flight read of real state,
  whether things are improving on the frozen test set, per-node gate
  charts, run history. The node proxy allowlist contains no round or
  bootstrap route. The **Federated round** panel at the top shows each
  node's human-reviewed labels against the 20 minimum, round state, last
  result and whether the aggregator listens, and has **Check labels** and
  **Run federated round** buttons (`app/api/fl/round/route.ts`). Those
  open a visible Git Bash window on this PC running
  `~/ARGUS/run-round-console.sh`; the POST is refused unless the request
  comes from localhost, with a same-origin `Origin`, and carries a valid
  dashboard session.
- **Federated history on disk** — `data/federated/history.json` and
  `operator-notes.jsonl` (gitignored; `ARGUS_FL_DATA_DIR` moves them).
  The aggregator and the nodes do not keep this, so leave the Federated
  page open during a round. Flower's REST address is
  `ARGUS_FLOWER_API`, default `http://localhost:8090`.
- **Design system** — dark, deliberately non-adaptive theme (see
  `app/globals.css`): near-black background, monospace for
  timestamps/data, a single teal accent reserved for "live" status,
  red reserved for actual security alerts (stranger events, offline
  state) — not used as decoration.
- **A throwaway mock backend** (`scripts/mock-backend.js`) so the whole
  app runs before Mohammed's real FastAPI backend exists. It is
  **not** the real backend — no persistence, hardcoded sample events,
  accepts any username/password.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # adjust if your backend isn't on :8000
```

Run the app and a backend side by side — two terminals:

```bash
# Terminal 1 — mock backend (skip this once the real backend exists;
# just point NEXT_PUBLIC_API_BASE_URL at it instead)
npm run mock-backend

# Terminal 2 — the dashboard
npm run dev
```

Open `http://localhost:3000`. Any username/password works against the
mock backend.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Where the FastAPI backend (real or mock) lives. |
| `ARGUS_NODES` | unset | Every node for the nav's tab bar and the All nodes page, `Label\|Name=URL` comma separated (e.g. `Camera 2\|Node B=http://10.0.0.129:8000,Camera 3\|Node C=http://10.0.0.139:8000`). The label is optional and is what the console shows; the name is the node's identity (its id and its key in `ARGUS_NODE_CREDS`). Adding a node is appending one entry and restarting the dev server. Server-side only: the proxy reaches a node by its id in this list, never a URL from the browser. Unset = one node at `NEXT_PUBLIC_API_BASE_URL`. |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | `admin` / none | The one dashboard login. No built-in password: sign-in is refused until it is set. |
| `DASHBOARD_SESSION_SECRET` | none (required) | Signs the session cookie: 32+ random characters. Without it no one can sign in, so a guessable key can never be used to forge a session. |
| `ARGUS_NODE_USER` / `ARGUS_NODE_PASSWORD` | `admin` / none | The node login the server uses for every node not in `ARGUS_NODE_CREDS`. |
| `ARGUS_NODE_CREDS` | unset | Per-node logins, `Name=user:pass` comma separated, keyed by node name, label or id. |
| `NEXT_PUBLIC_WS_EVENTS_URL` | derived from the above | Override if the WS endpoint lives somewhere else. |
| `AUTH_COOKIE_SECURE` | `false` | Set to `true` only once the device serves HTTPS. See the comment in `lib/config.ts` — this is a deliberate LAN-vs-TLS decision, not a build-mode side effect. |

## Backend contract

The frontend is built against this contract (FastAPI, JWT auth,
SQLite) — implement against this shape and no frontend changes should
be needed:

- `POST /api/login` → `{ access_token }` — called by the dashboard
  server (`lib/nodeAuth.ts`), never by the browser.
- `GET /api/auth/me` → `{ auth_required, ... }` — tells the server
  whether the node wants a token at all.
- `GET /api/status` → `{ fps, accelerator, model_version, nodes_online }`
- `GET /api/events` → array of event records
- `POST /api/events/{id}/label` → `{ action: "confirm" | "correct", label? }`
- `WS /ws/events` → live-pushed event objects, same shape as below
- `GET /api/camera/stream` → `multipart/x-mixed-replace` MJPEG
- `GET /api/camera/snapshot` → `image/jpeg`
- `GET /api/events/{id}/snapshot` → `image/jpeg`, 404 when the event has
  no stored still

All of these except the WS endpoint are reached through
`/api/argus/<suffix>` rather than directly, so they carry the session
token — see "Authenticated proxy" above.

Event record:

```json
{
  "id": 1,
  "cls": "person",
  "zone": "Front door",
  "node": "Node A",
  "ts": "2026-09-13T20:13:04Z",
  "status": "member",
  "label": "Household member",
  "confidence": 97,
  "confirmed": 0
}
```

`cls`: `person | vehicle | package | animal` · `status`: `member | stranger | na`

## Project layout

```
app/
  login/            login page
  dashboard/        side-by-side console (home)
  dashboard/live/   camera stream + recent detections
  dashboard/alerts/ flagged events only, with stills
  api/auth/         login/logout/session route handlers (cookie logic lives here)
  api/argus/        server-side proxy to the node, adds the bearer token
  page.tsx          "/" — pure auth-state redirect, not a real page
components/
  NodePanel.tsx     one node on the side-by-side console
  NodeAuthNotice.tsx  what a panel shows when a node answers 401
  StatusStrip.tsx, EventList.tsx, EventDetailPanel.tsx, StatusDot.tsx
  DashboardNav.tsx  shared header/nav, carries the alert count
  LiveFeed.tsx      MJPEG panel + its own failure states
  FeedModeBadge.tsx says whether events are pushed or polled
  dev/TestOfflineToggle.tsx   ← see "Known gaps" below
hooks/
  useEventFeed.ts   WS feed with a polling fallback, shared by all pages
  useNodeHealth.ts  one panel's status and temperature polling
lib/
  api.ts            typed client for the backend contract above
  AuthContext.tsx   global auth state (session status only, never the JWT)
  config.ts         API base URL, cookie name/security flag
  format.ts         timestamp formatting
hooks/
  useAuth.ts
proxy.ts            server-side route guard (Next 16's renamed middleware)
scripts/
  mock-backend.js   dev-only backend stand-in, see above
```

## Known gaps / next steps

- **The live socket goes straight to the node, without a token.** That
  works on nodes with `AUTH_REQUIRED=false`. On a node that requires
  auth the socket is refused and the feed falls back to polling
  `/api/events` through the proxy every 5 s, so it still updates, just
  not instantly. A server-side WebSocket hop would fix that.
- **No alert notifications.** The alerts feed has to be open to be
  seen; nothing pushes to the operator when the page is closed.
- **`components/dev/TestOfflineToggle.tsx` is a QA aid, not a
  feature.** It fakes the offline status-strip look without touching
  the real connection, for visual testing. Nothing wires it in since
  `/dashboard` became the side-by-side view; any place it's wired in
  is marked `// TEST ONLY — remove before final build` — grep for that
  string before shipping.
- **HTTPS is an open decision, not solved.** `AUTH_COOKIE_SECURE`
  defaults to `false` (LAN-only HTTP). If this ever needs to run
  behind TLS, or if the two nodes end up exposed on separate hosts
  instead of one shared address, the cookie/CORS setup here will need
  revisiting — see the comment in `lib/config.ts`.
- **Mock vs. real backend.** `scripts/mock-backend.js` answers 503 on
  the camera endpoints — there is no fake video, so the live page shows
  its "camera unavailable" state unless you point at a real node. It
  keeps labels only in memory, and invents an event every 20s so the
  polling fallback visibly does something. Swapping in the real backend is
  just pointing `NEXT_PUBLIC_API_BASE_URL` at it — no frontend code
  changes required as long as it matches the contract above.

