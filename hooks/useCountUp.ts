"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 280;

/** The number as it counts from what was shown to the new value. */
export function useCountUp(value: number | null): number | null {
  const [shown, setShown] = useState<number | null>(null);
  const from = useRef(0);

  useEffect(() => {
    if (value === null) return;
    const start = from.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let began: number | null = null;

    const step = (now: number) => {
      began ??= now;
      const done = still ? 1 : Math.min(1, (now - began) / DURATION_MS);
      const current = start + (value - start) * (1 - (1 - done) ** 3);
      from.current = current;
      setShown(current);
      if (done < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return value === null ? null : (shown ?? 0);
}
