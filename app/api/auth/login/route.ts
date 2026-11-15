import { NextResponse } from "next/server";
import { AUTH_COOKIE_SECURE } from "@/lib/config";
import {
  checkDashboardCredentials,
  createSessionValue,
  DASHBOARD_COOKIE_NAME,
  dashboardConfigProblem,
  SESSION_TTL_SECONDS,
} from "@/lib/dashboardSession";

// The one sign-in for the whole dashboard. Checks DASHBOARD_USER /
// DASHBOARD_PASSWORD (lib/dashboardSession.ts) and sets the signed,
// HttpOnly session cookie. It does not talk to any node: the server
// signs in to the nodes on its own (lib/nodeAuth.ts).

// A brake on password guessing: after MAX_FAILURES wrong tries, refuse
// every sign-in for the rest of the window. One shared counter, not one
// per address: a route handler cannot see the real client address, and
// X-Forwarded-For is set by the client, so keying on it would let each
// guess pick a fresh counter. On a one-operator LAN console, a few
// minutes' lockout after a burst of bad guesses is the right trade.
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 5 * 60_000;
let failures: { count: number; since: number } | null = null;

function isLockedOut(): boolean {
  if (!failures) return false;
  if (Date.now() - failures.since > FAILURE_WINDOW_MS) {
    failures = null;
    return false;
  }
  return failures.count >= MAX_FAILURES;
}

function recordFailure(): void {
  failures = failures
    ? { ...failures, count: failures.count + 1 }
    : { count: 1, since: Date.now() };
}

export async function POST(request: Request) {
  if (isLockedOut()) {
    return NextResponse.json(
      { error: "Too many failed attempts. Wait a few minutes." },
      { status: 429 },
    );
  }

  const problem = dashboardConfigProblem();
  if (problem) {
    return NextResponse.json({ error: `Dashboard sign-in not set up: ${problem}` }, { status: 503 });
  }

  let username: unknown;
  let password: unknown;
  try {
    ({ username, password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  if (!checkDashboardCredentials(username, password)) {
    recordFailure();
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = createSessionValue(username);
  if (!session) {
    return NextResponse.json({ error: "Dashboard sign-in not set up" }, { status: 503 });
  }

  failures = null;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DASHBOARD_COOKIE_NAME, session, {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
