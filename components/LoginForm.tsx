"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { StatusDot } from "@/components/StatusDot";

/**
 * Only same-origin paths, so ?from= cannot bounce a login off-site.
 * Resolving with URL catches every trick the parser itself would apply
 * ("//host", "/\host", tabs and newlines inside the path).
 */
function safeNext(from: string | undefined): string {
  if (!from || !from.startsWith("/") || /[\x00-\x20\\]/.test(from)) return "/dashboard";
  try {
    const target = new URL(from, window.location.origin);
    if (target.origin !== window.location.origin) return "/dashboard";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/dashboard";
  }
}

/**
 * The one sign-in for the whole console. The dashboard server then signs
 * in to every camera itself, so switching cameras never asks again.
 */
export function LoginForm({ cameras, from }: { cameras: string[]; from?: string }) {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      router.replace(safeNext(from));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-muted uppercase">
              ARGUS
            </p>
            <h1 className="mt-1 text-lg font-medium text-foreground">
              Security console
            </h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
            <StatusDot tone="live" />
            <span>NODES ONLINE</span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-md border border-border bg-surface p-6"
        >
          <div className="space-y-4">
            {cameras.length > 0 && (
              <p className="font-mono text-[11px] leading-relaxed text-muted">
                One sign-in for{" "}
                <span className="text-foreground">{cameras.join(", ")}</span>
              </p>
            )}

            <div>
              <label
                htmlFor="username"
                className="block font-mono text-[11px] tracking-wider text-muted uppercase"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 w-full rounded border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-accent"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block font-mono text-[11px] tracking-wider text-muted uppercase"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded border border-danger/30 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded bg-accent py-2 font-mono text-xs font-semibold tracking-[0.2em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Authenticating…" : "Authenticate"}
          </button>
        </form>
      </div>
    </div>
  );
}
