// Mohammed's FastAPI backend. Not built yet — see CLAUDE.md for the
// endpoint contract this frontend is wired against.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const WS_EVENTS_URL =
  process.env.NEXT_PUBLIC_WS_EVENTS_URL ??
  API_BASE_URL.replace(/^http/, "ws") + "/ws/events";

export const AUTH_COOKIE_NAME = "argus_session";

// Deliberately NOT tied to NODE_ENV. ARGUS is a LAN-only home device —
// a production build served over plain http:// on the home network is
// the expected deployment, not an edge case. Browsers drop `Secure`
// cookies over non-HTTPS, so tying this to NODE_ENV silently breaks
// login the day someone runs a real production build without TLS.
// Flip to "true" only once the device terminates TLS (e.g. a
// self-signed cert on the Pi) — that's a deployment decision, not a
// build-mode side effect.
export const AUTH_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE === "true";
