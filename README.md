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

- **Auth** — login form → JWT issued by the backend → stored as an
  **HttpOnly cookie** (never touches client-side JS or `localStorage`).
  A route guard (`proxy.ts`) reads the cookie server-side to gate
  `/dashboard`.
- **Dashboard** (`/dashboard`) —
  - **Status strip**: FPS, accelerator, model version, nodes online.
    Three visual states — connecting / online / offline — the offline
    look also covers a real fetch failure, not just the test toggle.
  - **Event list**: pulled from `GET /api/events`, flags `stranger`
    detections with a red indicator.
  - **Detail panel**: click an event to see its full record, with
    **Confirm** / **Correct** actions wired to
    `POST /api/events/{id}/label`.
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
| `NEXT_PUBLIC_WS_EVENTS_URL` | derived from the above | Override if the WS endpoint lives somewhere else. |
| `AUTH_COOKIE_SECURE` | `false` | Set to `true` only once the device serves HTTPS. See the comment in `lib/config.ts` — this is a deliberate LAN-vs-TLS decision, not a build-mode side effect. |

## Backend contract

The frontend is built against this contract (FastAPI, JWT auth,
SQLite) — implement against this shape and no frontend changes should
be needed:

- `POST /api/login` → `{ access_token }` — expected to move to a
  `Set-Cookie` response once the backend sets the HttpOnly cookie
  itself; until then, `app/api/auth/login/route.ts` sets it on the
  backend's behalf.
- `GET /api/status` → `{ fps, accelerator, model_version, nodes_online }`
- `GET /api/events` → array of event records
- `POST /api/events/{id}/label` → `{ action: "confirm" | "correct", label? }`
- `WS /ws/events` → live-pushed event objects, same shape as below

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
  dashboard/        the actual dashboard page
  api/auth/         login/logout/session route handlers (cookie logic lives here)
  page.tsx          "/" — pure auth-state redirect, not a real page
components/
  StatusStrip.tsx, EventList.tsx, EventDetailPanel.tsx, StatusDot.tsx
  dev/TestOfflineToggle.tsx   ← see "Known gaps" below
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

- **No live push yet.** `connectEventsSocket()` in `lib/api.ts` is
  implemented but nothing calls it — the event list is a one-time
  fetch, not the real-time feed the proposal (FR-8) describes. Wiring
  `/ws/events` into the dashboard is the natural next feature.
- **`components/dev/TestOfflineToggle.tsx` is a QA aid, not a
  feature.** It fakes the offline status-strip look without touching
  the real connection, for visual testing. Every place it's wired in
  is marked `// TEST ONLY — remove before final build` — grep for that
  string before shipping.
- **HTTPS is an open decision, not solved.** `AUTH_COOKIE_SECURE`
  defaults to `false` (LAN-only HTTP). If this ever needs to run
  behind TLS, or if the two nodes end up exposed on separate hosts
  instead of one shared address, the cookie/CORS setup here will need
  revisiting — see the comment in `lib/config.ts`.
- **Mock vs. real backend.** `scripts/mock-backend.js` has hardcoded
  sample events and no persistence. Swapping in the real backend is
  just pointing `NEXT_PUBLIC_API_BASE_URL` at it — no frontend code
  changes required as long as it matches the contract above.

