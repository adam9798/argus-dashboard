"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Shown where a node answered 401. With one dashboard login
 * (lib/dashboardSession.ts) and the server signing in to every node itself
 * (lib/nodeAuth.ts), that means one of two things: this browser's dashboard
 * session ran out, or the node turned down the server's credentials. The
 * browser never sends a node password, so there is no form here.
 */
export function NodeAuthNotice({
  nodeName,
  onRetry,
}: {
  nodeName: string;
  onRetry: () => void;
}) {
  const router = useRouter();
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data: { authenticated?: boolean }) => {
        if (!cancelled) setSessionValid(Boolean(data.authenticated));
      })
      .catch(() => {
        if (!cancelled) setSessionValid(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (sessionValid === false) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          Dashboard session ended
        </p>
        <button
          type="button"
          onClick={() => {
            const from = window.location.pathname + window.location.search;
            router.push(`/login?from=${encodeURIComponent(from)}`);
          }}
          className="w-full rounded bg-accent py-2 text-center font-mono text-xs font-semibold tracking-[0.2em] text-background uppercase transition-opacity hover:opacity-90"
        >
          Sign in again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <p className="font-mono text-xs tracking-widest text-danger uppercase">
        {nodeName} rejected the dashboard&apos;s sign-in
      </p>
      <p className="font-mono text-[11px] leading-relaxed text-muted">
        Check this node&apos;s login in .env.local (ARGUS_NODE_USER /
        ARGUS_NODE_PASSWORD, or its entry in ARGUS_NODE_CREDS). After a
        rejection the server waits about 2 minutes before trying the node
        again, so the node&apos;s own rate limit never locks the account.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="w-full rounded border border-border py-2 font-mono text-xs tracking-[0.2em] text-muted uppercase transition-colors hover:border-accent hover:text-foreground"
      >
        Retry
      </button>
    </div>
  );
}
