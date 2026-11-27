import type { DiscordPayload } from "@/lib/alerts/format";

// Delivery to a Discord webhook. The URL comes from the environment only and
// is never logged, returned to the browser or committed.

export function webhookUrl(): string | null {
  const url = process.env.ARGUS_DISCORD_WEBHOOK_URL?.trim();
  if (!url) return null;
  return /^https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api\/webhooks\//.test(url) ? url : null;
}

export class DeliveryError extends Error {}

const RETRY_DELAYS_MS = [1000, 3000, 8000];
const MAX_RETRY_AFTER_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One POST. Resolves on success; throws with a message that never contains
 * the webhook URL.
 */
async function postOnce(url: string, payload: DiscordPayload): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new DeliveryError(
      `network error: ${err instanceof Error ? err.name : "unknown"}`,
    );
  }
  if (res.ok) return;
  if (res.status === 429) {
    let wait = 2000;
    try {
      const body = (await res.json()) as { retry_after?: number };
      if (typeof body.retry_after === "number") wait = body.retry_after * 1000;
    } catch {
      // no body; fall back to the default wait
    }
    const err = new DeliveryError("rate limited by Discord");
    (err as DeliveryError & { retryAfterMs?: number }).retryAfterMs = Math.min(
      wait,
      MAX_RETRY_AFTER_MS,
    );
    throw err;
  }
  // Wrong or deleted webhook: retrying cannot help.
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    const err = new DeliveryError(`Discord rejected the webhook (HTTP ${res.status})`);
    (err as DeliveryError & { permanent?: boolean }).permanent = true;
    throw err;
  }
  throw new DeliveryError(`Discord answered HTTP ${res.status}`);
}

/** Sends with retry and backoff. Throws the last error after the final try. */
export async function deliver(payload: DiscordPayload): Promise<void> {
  const url = webhookUrl();
  if (!url) throw new DeliveryError("Discord webhook is not configured");

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await postOnce(url, payload);
      return;
    } catch (err) {
      lastError = err;
      const meta = err as DeliveryError & { permanent?: boolean; retryAfterMs?: number };
      if (meta.permanent || attempt === RETRY_DELAYS_MS.length) break;
      await sleep(meta.retryAfterMs ?? RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError instanceof Error ? lastError : new DeliveryError("delivery failed");
}
