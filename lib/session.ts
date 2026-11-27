import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { sessionCookieName } from "@/lib/nodeSessions";
import { trustedNodeIds } from "@/lib/nodes";

// Signed session cookies. Server-only.
//
// People sign in with a node's own username and password; the node checks it.
// What the dashboard puts in the cookie is that node's token plus an expiry,
// signed with a key only this server holds, so a cookie it did not issue is
// rejected. The cookie is bound to one node: A's cannot be passed off as B's.
//
//   v1.<token, base64url>.<expiry, unix seconds>.<HMAC-SHA256>

export const SESSION_SECONDS = 60 * 60 * 8;

const MIN_SECRET_LENGTH = 32;
let cached: string | null = null;

/** ARGUS_SESSION_SECRET, or a random key made once and kept in data/. */
function secret(): string {
  const set = process.env.ARGUS_SESSION_SECRET?.trim();
  if (set) {
    if (set.length < MIN_SECRET_LENGTH) {
      throw new Error(`ARGUS_SESSION_SECRET needs at least ${MIN_SECRET_LENGTH} characters`);
    }
    return set;
  }
  if (cached) return cached;

  const file =
    process.env.ARGUS_SESSION_SECRET_FILE ?? path.join(process.cwd(), "data", "session-secret");
  mkdirSync(path.dirname(file), { recursive: true });
  try {
    // "wx": whoever gets here first creates it; nobody overwrites it.
    writeFileSync(file, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
  const value = readFileSync(file, "utf8").trim();
  // A short or empty key would make signatures guessable: refuse to run on it.
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${file} is damaged; delete it and restart to make a new one`);
  }
  cached = value;
  return value;
}

function signature(nodeId: string, body: string): Buffer {
  return createHmac("sha256", secret()).update(`${nodeId}\n${body}`).digest();
}

/** The cookie value for a token this node has just issued. */
export function sealSession(nodeId: string, token: string): string {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const body = `v1.${Buffer.from(token, "utf8").toString("base64url")}.${expires}`;
  return `${body}.${signature(nodeId, body).toString("base64url")}`;
}

/** The node token inside a genuine, unexpired cookie; otherwise null. */
export function openSession(nodeId: string, value: string | undefined): string | null {
  const parts = value?.split(".") ?? [];
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [version, token, expires, mac] = parts;
  const expected = signature(nodeId, `${version}.${token}.${expires}`);
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (!(Number(expires) * 1000 > Date.now())) return null;
  return Buffer.from(token, "base64url").toString("utf8") || null;
}

/** Works with both request.cookies and next/headers cookies(). */
interface CookieJar {
  get(name: string): { value: string } | undefined;
}

/** This browser's token for the node, if it really signed in to it. */
export function nodeToken(jar: CookieJar, nodeId: string): string | null {
  return openSession(nodeId, jar.get(sessionCookieName(nodeId))?.value);
}

/**
 * Signed in to the console as a whole. Only nodes the owner listed count, so a
 * stranger's machine that discovery picked up cannot vouch for anyone.
 */
export function hasAnySession(jar: CookieJar): boolean {
  return trustedNodeIds().some((id) => nodeToken(jar, id) !== null);
}
