import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The dashboard's own sign-in: one username and password for the whole
// console, independent of the ARGUS nodes. The nodes are signed in to by
// the server itself (lib/nodeAuth.ts), so switching cameras never asks
// for a password again.
//
// The session cookie is `<user>.<expiry>.<hmac>`, signed with
// DASHBOARD_SESSION_SECRET (required). No server-side session store: proxy.ts can
// check a cookie with nothing but the secret, and a dev-server restart
// does not sign anyone out. Plain node:crypto, no next/* imports, so
// proxy.ts and route handlers can both use it.

export const DASHBOARD_COOKIE_NAME = "argus_session";

/** How long one sign-in lasts. */
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

const DEFAULT_USER = "admin";

function dashboardUser(): string {
  return process.env.DASHBOARD_USER?.trim() || DEFAULT_USER;
}

/** Values copied unchanged from .env.local.example are not a real login. */
function isPlaceholder(value: string): boolean {
  return value.startsWith("change-me");
}

/**
 * Deliberately no built-in default: a password in source would end up in
 * git. The default login lives in the git-ignored .env.local instead.
 */
function dashboardPassword(): string | null {
  const value = process.env.DASHBOARD_PASSWORD;
  return value && !isPlaceholder(value) ? value : null;
}

const MIN_SECRET_LENGTH = 32;

/**
 * The signing key, DASHBOARD_SESSION_SECRET. Required: with no key (or a
 * short or placeholder one) no session is issued or accepted, so a
 * guessable key can never let a forged cookie through proxy.ts.
 */
function sessionSecret(): string | null {
  const value = process.env.DASHBOARD_SESSION_SECRET?.trim() ?? "";
  return value.length >= MIN_SECRET_LENGTH && !isPlaceholder(value) ? value : null;
}

/** What is missing from .env.local for sign-in to work, or null. */
export function dashboardConfigProblem(): string | null {
  if (!dashboardPassword()) return "add DASHBOARD_PASSWORD to .env.local";
  if (!sessionSecret()) {
    return `add DASHBOARD_SESSION_SECRET (${MIN_SECRET_LENGTH}+ random characters) to .env.local`;
  }
  return null;
}

/** Constant-time string compare: hash both sides so lengths match. */
function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function checkDashboardCredentials(username: string, password: string): boolean {
  const expected = dashboardPassword();
  if (!expected) return false;
  // Evaluate both, so a wrong username takes as long as a wrong password.
  const userOk = safeEqual(username, dashboardUser());
  const passOk = safeEqual(password, expected);
  return userOk && passOk;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** A signed session cookie value, or null when no signing key is set. */
export function createSessionValue(username: string, nowMs = Date.now()): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const expires = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `${Buffer.from(username).toString("base64url")}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** True for a cookie this server signed that has not expired yet. */
export function isValidSession(value: string | null | undefined, nowMs = Date.now()): boolean {
  const secret = sessionSecret();
  if (!value || !secret) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [user, expires, signature] = parts;
  if (!safeEqual(signature, sign(`${user}.${expires}`, secret))) return false;
  const expiry = Number(expires);
  return Number.isFinite(expiry) && nowMs < expiry * 1000;
}
