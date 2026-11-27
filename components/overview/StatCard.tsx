"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import { smoothPath, type Point } from "@/lib/chart";

/** A small trend with no axes: shape only. The value beside it is the number. */
export function Sparkline({ values }: { values: number[] }) {
  const fill = useId();
  const W = 120;
  const H = 52;

  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden="true">
        <line x1="4" x2={W - 4} y1={H / 2} y2={H / 2} stroke="var(--chart-axis)" strokeDasharray="3 5" />
      </svg>
    );
  }

  const low = Math.min(...values);
  // A flat series is drawn flat, not stretched into noise.
  const span = Math.max(Math.max(...values) - low, 2);
  const points: Point[] = values.map((value, index) => [
    4 + (index / (values.length - 1)) * (W - 8),
    H - 6 - ((value - low) / span) * (H - 12),
  ]);
  const line = smoothPath(points);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${W - 4},${H}L4,${H}Z`} fill={`url(#${fill})`} />
      <path d={line} pathLength={1} className="draw" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  digits = 0,
  suffix,
  hint,
  color,
  visual,
  href,
  delay = 0,
}: {
  label: string;
  /** Null while nothing has reported it. */
  value: number | null;
  digits?: number;
  suffix?: string;
  hint: string;
  color?: string;
  visual: ReactNode;
  href?: string;
  delay?: number;
}) {
  const shown = useCountUp(value);

  const body = (
    <>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p
          className="mt-1 font-mono text-3xl leading-none whitespace-nowrap text-foreground tabular-nums sm:text-4xl"
          style={color ? { color } : undefined}
        >
          {shown === null ? "–" : shown.toFixed(digits)}
          {shown !== null && suffix && <span className="ml-0.5 text-lg text-muted">{suffix}</span>}
        </p>
        <p className="mt-2 text-xs text-muted">{hint}</p>
      </div>
      <div className="h-14 w-full self-end sm:w-28 sm:shrink-0">{visual}</div>
    </>
  );

  const className =
    "card card-lift rise flex min-w-0 flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5";
  const style = { animationDelay: `${delay}ms` };

  return href ? (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  );
}
