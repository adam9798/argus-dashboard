"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { NodeSwitcher } from "@/components/NodeSwitcher";
import { FindNodes } from "@/components/FindNodes";
import { LogoMark } from "@/components/icons";
import { NODES_CHANGED_EVENT } from "@/hooks/useNodes";

const INPUT =
  "mt-2 min-h-12 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-base text-foreground outline-none focus:border-accent";

export default function LoginPage() {
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
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center px-4 py-8">
      <div className="stagger w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="card mb-4 flex h-16 w-16 items-center justify-center">
            <LogoMark width={36} height={36} className="text-accent" />
          </span>
          <h1 className="font-mono text-4xl tracking-tight text-foreground">
            ARGUS <span className="text-accent/70">Console</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Sign in with a camera node&apos;s username and password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-5 sm:p-7">
          <div className="space-y-5">
            {/* Each node signs its own logins, so pick the node first. The
                choice used to live only in the nav, which a browser left on
                an offline node could never reach. */}
            <div>
              <span className="mb-2 block text-sm text-muted">Node</span>
              <NodeSwitcher />
              {/* A new network can leave the saved addresses wrong, which
                  would otherwise block sign-in. */}
              <div className="mt-3">
                <FindNodes
                  onFound={() => window.dispatchEvent(new Event(NODES_CHANGED_EVENT))}
                />
              </div>
            </div>

            <label className="block">
              <span className="text-sm text-muted">Username</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT}
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="alert-in mt-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-accent text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <span className="spinner" aria-hidden />}
            {submitting ? "Checking with the node…" : "Sign in"}
          </button>
          {submitting && (
            <p className="fade-in mt-3 text-center text-xs text-muted">
              This can take up to 10 seconds. Please don&apos;t press it again.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
