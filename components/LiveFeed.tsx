"use client";

/* eslint-disable @next/next/no-img-element */
// Deliberately a plain <img>, not next/image: this is an endless
// multipart/x-mixed-replace MJPEG response, not an asset to optimize,
// and the optimizer would try to fetch and resize it once.

import { useEffect, useState } from "react";
import { liveStreamUrl } from "@/lib/api";
import { CloseIcon, ExpandIcon } from "./icons";
import { StatusDot } from "./StatusDot";

type StreamState = "loading" | "streaming" | "error";

export function LiveFeed({ nodeId, nodeName }: { nodeId: string; nodeName: string }) {
  const [state, setState] = useState<StreamState>("loading");
  // Bumping this remounts the <img>, which is the only reliable way to
  // reopen an MJPEG connection the browser has already given up on.
  const [attempt, setAttempt] = useState(0);
  const [large, setLarge] = useState(false);

  function retry() {
    setState("loading");
    setAttempt((n) => n + 1);
  }

  useEffect(() => {
    if (!large) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLarge(false);
    };
    // The page behind must not scroll while the camera covers it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [large]);

  return (
    // Enlarging restyles this same box, so the one stream carries on: no
    // second connection to the node and no reconnect.
    <div
      role={large ? "dialog" : undefined}
      aria-modal={large || undefined}
      aria-label={large ? `${nodeName} camera` : undefined}
      onClick={(event) => {
        if (large && event.target === event.currentTarget) setLarge(false);
      }}
      className={
        large
          ? "fade-in fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-3 sm:p-8"
          : "relative bg-black"
      }
    >
      <div
        className={`relative w-full ${
          large ? "overflow-hidden rounded-2xl border border-border bg-black" : ""
        }`}
        // As wide as fits while the whole 16:9 picture stays on screen.
        style={large ? { maxWidth: "calc((100dvh - 4rem) * 16 / 9)" } : undefined}
      >
        {/* The state sits on the picture, so the picture is bigger. */}
        <span className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-muted backdrop-blur">
          <StatusDot
            tone={state === "streaming" ? "live" : state === "error" ? "down" : "idle"}
            pulse={state === "streaming"}
          />
          {large && <span className="text-foreground">{nodeName}</span>}
          {state === "streaming" ? "Live" : state === "error" ? "No signal" : "Opening…"}
        </span>
        <button
          type="button"
          onClick={() => setLarge((value) => !value)}
          aria-label={large ? "Close the large view" : `Enlarge ${nodeName} camera`}
          className="absolute top-2 right-2 z-10 flex min-h-10 items-center gap-2 rounded-full bg-black/60 px-3 text-xs text-foreground backdrop-blur hover:bg-black/80"
        >
          {large ? <CloseIcon width={16} height={16} /> : <ExpandIcon width={16} height={16} />}
          {large ? "Close" : "Enlarge"}
        </button>

        <div className={`aspect-video w-full ${large ? "" : "max-h-[42vh]"}`}>
          {state !== "error" && (
            <img
              key={attempt}
              // Several streams share one phone hotspot in a panel view.
              src={liveStreamUrl(nodeId, { quality: 70, r: attempt })}
              alt={`Live camera feed from ${nodeName}`}
              className="h-full w-full object-contain"
              onLoad={() => setState("streaming")}
              onError={() => setState("error")}
            />
          )}
        </div>

        {state === "loading" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-muted">Opening camera stream…</p>
          </div>
        )}

        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-xs text-danger">Camera stream unavailable</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted">
              The camera may be uninitialised, in use by another process, or the node may be
              unreachable.
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-full border border-border px-4 py-2 text-xs text-muted hover:border-accent hover:text-foreground"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
