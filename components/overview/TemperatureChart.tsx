"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { smoothPath, type Point, type Sample } from "@/lib/chart";

export interface TempSeries {
  id: string;
  name: string;
  color: string;
  samples: Sample[];
}

const HEIGHT = 230;
const PAD = { l: 40, r: 16, t: 12, b: 26 };

const clock = (t: number) =>
  new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** The reading closest in time to `t`. */
function nearest(samples: Sample[], t: number): Sample {
  return samples.reduce((best, sample) =>
    Math.abs(sample.t - t) < Math.abs(best.t - t) ? sample : best,
  );
}

/** SoC temperature of every node on one axis. */
export function TemperatureChart({ series }: { series: TempSeries[] }) {
  const box = useRef<HTMLDivElement>(null);
  // Drawn at the real width, so labels stay readable on a phone.
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const drawn = series.filter((line) => line.samples.length > 1);
  const all = drawn.flatMap((line) => line.samples);
  const t0 = Math.min(...all.map((s) => s.t));
  const t1 = Math.max(...all.map((s) => s.t));
  const low = Math.floor((Math.min(...all.map((s) => s.v)) - 3) / 5) * 5;
  const high = Math.ceil((Math.max(...all.map((s) => s.v)) + 3) / 5) * 5;

  const x = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (width - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - low) / (high - low)) * (HEIGHT - PAD.t - PAD.b);
  const ticks = [0, 1, 2, 3].map((i) => low + ((high - low) * i) / 3);

  const move = (event: PointerEvent<SVGSVGElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const share = (event.clientX - left - PAD.l) / Math.max(1, width - PAD.l - PAD.r);
    setHover(t0 + Math.min(1, Math.max(0, share)) * (t1 - t0));
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <h2 className="text-base text-foreground">
          Node temperature <span className="text-muted">last hour, °C</span>
        </h2>
        <ul className="flex flex-wrap gap-4 text-xs text-muted">
          {drawn.map((line) => (
            <li key={line.id} className="flex items-center gap-2">
              <span className="h-0.5 w-4 rounded-full" style={{ background: line.color }} />
              {line.name}
              <span className="font-mono text-foreground">
                {line.samples[line.samples.length - 1].v.toFixed(1)}°
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div ref={box} className="relative" style={{ height: HEIGHT }}>
        {drawn.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted">
            No temperature history yet.
          </p>
        ) : (
          width > 0 && (
            <>
              <svg
                width={width}
                height={HEIGHT}
                role="img"
                aria-label="Temperature of each node over the last hour"
                onPointerMove={move}
                onPointerDown={move}
                onPointerLeave={() => setHover(null)}
                className="touch-pan-y"
              >
                {ticks.map((tick) => (
                  <g key={tick}>
                    <line x1={PAD.l} x2={width - PAD.r} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" strokeDasharray="4 6" />
                    <text x={PAD.l - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                      {Math.round(tick)}°
                    </text>
                  </g>
                ))}
                {drawn.map((line) => {
                  const points: Point[] = line.samples.map((s) => [x(s.t), y(s.v)]);
                  return (
                    <path
                      key={line.id}
                      d={smoothPath(points)}
                      pathLength={1}
                      className="draw"
                      fill="none"
                      stroke={line.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  );
                })}
                {hover !== null && (
                  <g>
                    <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={HEIGHT - PAD.b} stroke="var(--chart-axis)" />
                    {drawn.map((line) => {
                      const sample = nearest(line.samples, hover);
                      return (
                        <circle key={line.id} cx={x(sample.t)} cy={y(sample.v)} r={4.5} fill={line.color} stroke="var(--surface)" strokeWidth={2} />
                      );
                    })}
                  </g>
                )}
                <text x={PAD.l} y={HEIGHT - 6} fontSize={11} fill="var(--muted)">{clock(t0)}</text>
                <text x={width - PAD.r} y={HEIGHT - 6} textAnchor="end" fontSize={11} fill="var(--muted)">{clock(t1)}</text>
              </svg>

              {hover !== null && (
                <div
                  className="pointer-events-none absolute top-1 rounded-xl border border-border bg-surface-raised/95 px-3 py-2 text-xs shadow-xl"
                  style={x(hover) > width / 2 ? { right: width - x(hover) + 10 } : { left: x(hover) + 10 }}
                >
                  <p className="mb-1 font-mono text-muted">{clock(hover)}</p>
                  {drawn.map((line) => (
                    <p key={line.id} className="flex items-center gap-2 whitespace-nowrap text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: line.color }} />
                      {line.name}
                      <span className="ml-auto pl-3 font-mono text-foreground">
                        {nearest(line.samples, hover).v.toFixed(1)}°
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
