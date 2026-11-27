"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { DashboardNav } from "@/components/DashboardNav";
import { NodeGate } from "@/components/NodeGate";
import { AMBER, tempColor } from "@/lib/format";
import {
  api,
  ApiError,
  thermalCsvUrl,
  type ThermalHistory,
  type ThermalSample,
  type ThermalStatus,
} from "@/lib/api";

// How the selected node's enclosure is holding up: SoC temperature
// against the Pi 5's limits (clock drops at 80 C, hard throttle at 85 C),
// throttle flags, fan and the detection rate on the same timeline. The
// node logs every sample to data/thermal/ as well; the CSV button is that
// window, for soak-test records and the poster.

const WINDOWS = [
  { minutes: 30, label: "30 min" },
  { minutes: 120, label: "2 h" },
  { minutes: 480, label: "8 h" },
  { minutes: 1440, label: "24 h" },
] as const;

const REFRESH_MS = 15_000;
function fmt(value: number | null | undefined, unit: string, digits = 1): string {
  return value == null ? "–" : `${value.toFixed(digits)}${unit}`;
}

function Tile({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-muted first-letter:uppercase">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Chart({ samples, soft, hard }: { samples: ThermalSample[]; soft: number; hard: number }) {
  // Drawn at the real width, so the labels stay readable on a phone. A
  // callback ref, because the box appears only once there are samples.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    if (!box) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.round(entry.contentRect.width))),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);
  const W = width;
  const H = 260;
  const pad = { l: 44, r: 44, t: 12, b: 26 };
  const temps = samples.filter((s) => s.soc_temp_c != null);

  if (temps.length < 2) {
    return (
      <div className="flex h-[260px] items-center justify-center card text-xs text-muted">
        {samples.length === 0
          ? "No samples yet. The node records one every interval."
          : "No temperature sensor reported (not running on a Pi?)."}
      </div>
    );
  }

  const t0 = samples[0].ts;
  const t1 = samples[samples.length - 1].ts;
  const span = Math.max(1, t1 - t0);
  const values = temps.map((s) => s.soc_temp_c as number);
  const lo = Math.min(30, Math.floor(Math.min(...values) / 5) * 5);
  const hi = Math.max(hard + 5, Math.ceil(Math.max(...values) / 5) * 5);
  const fpsMax = Math.max(30, ...samples.map((s) => s.detect_fps ?? 0));

  const x = (ts: number) => pad.l + ((ts - t0) / span) * (W - pad.l - pad.r);
  const y = (c: number) => pad.t + (1 - (c - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const yf = (f: number) => pad.t + (1 - f / fpsMax) * (H - pad.t - pad.b);

  const tempPath = temps.map((s, i) => `${i ? "L" : "M"}${x(s.ts).toFixed(1)},${y(s.soc_temp_c as number).toFixed(1)}`).join("");
  const fpsPts = samples.filter((s) => s.detect_fps != null);
  const fpsPath = fpsPts.map((s, i) => `${i ? "L" : "M"}${x(s.ts).toFixed(1)},${yf(s.detect_fps as number).toFixed(1)}`).join("");
  const throttled = samples.filter((s) => s.throttled_now.length > 0);
  const ticks = [lo, ...[50, 60, 70, 80, 90].filter((c) => c > lo && c < hi), hi];
  const clock = (ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="card p-3">
      <div ref={setBox}>
      <svg width={W} height={H} className="block" role="img" aria-label="SoC temperature over time">
        {ticks.map((c) => (
          <g key={c}>
            <line x1={pad.l} x2={W - pad.r} y1={y(c)} y2={y(c)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(c) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{c}°</text>
          </g>
        ))}
        {[soft, hard].map((c) => (
          <g key={`limit-${c}`}>
            <line x1={pad.l} x2={W - pad.r} y1={y(c)} y2={y(c)} stroke="var(--danger)" strokeDasharray="5 4" strokeWidth={1} opacity={c === soft ? 0.6 : 1} />
            <text x={W - pad.r - 4} y={y(c) - 4} textAnchor="end" fontSize={10} fill="var(--danger)">
              {c === soft ? `clock drops ${c}°` : `throttle ${c}°`}
            </text>
          </g>
        ))}
        {throttled.map((s) => (
          <rect key={s.ts} x={x(s.ts) - 2} y={pad.t} width={4} height={H - pad.t - pad.b} fill="var(--danger)" opacity={0.25} />
        ))}
        {fpsPath && <path d={fpsPath} fill="none" stroke="var(--muted)" strokeWidth={1.25} opacity={0.6} />}
        <path d={tempPath} pathLength={1} className="draw" fill="none" stroke="var(--accent)" strokeWidth={2} />
        <text x={W - pad.r + 6} y={yf(fpsMax) + 4} fontSize={10} fill="var(--muted)">{Math.round(fpsMax)} fps</text>
        <text x={W - pad.r + 6} y={yf(0)} fontSize={10} fill="var(--muted)">0</text>
        <text x={pad.l} y={H - 6} fontSize={11} fill="var(--muted)">{clock(t0)}</text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize={11} fill="var(--muted)">{clock(t1)}</text>
      </svg>
      </div>
      <p className="px-2 pb-1 text-xs text-muted">
        <span style={{ color: "var(--accent)" }}>━</span> SoC °C &nbsp;
        <span>━</span> detection FPS (right) &nbsp;
        <span style={{ color: "var(--danger)" }}>▮</span> throttled
      </p>
    </div>
  );
}

export default function ThermalPage() {
  return (
    <NodeGate title="Thermal">
      <ThermalContent />
    </NodeGate>
  );
}

/** Mounted only once the picked node has answered and accepted the sign-in. */
function ThermalContent() {
  const { status } = useAuth();
  const router = useRouter();
  const [minutes, setMinutes] = useState<number>(120);
  const [thermal, setThermal] = useState<ThermalStatus | null>(null);
  const [history, setHistory] = useState<ThermalHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Fetch now and every REFRESH_MS. State is only set after the await,
  // and never once the window or page has changed underneath.
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function tick() {
      try {
        const [current, past] = await Promise.all([api.getThermal(), api.getThermalHistory(minutes)]);
        if (cancelled) return;
        setThermal(current);
        setHistory(past);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? "This node does not report temperature yet. Update it (git pull) and restart the node."
            : err instanceof ApiError
              ? err.message
              : "Failed to load thermal data",
        );
      }
    }

    void tick();
    const timer = setInterval(() => void tick(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status, minutes]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <p className="text-xs text-muted first-letter:uppercase">
          {status === "loading" ? "Checking session…" : "Redirecting…"}
        </p>
      </div>
    );
  }

  const soft = thermal?.limits_c.soft ?? 80;
  const hard = thermal?.limits_c.hard ?? 85;
  const now = thermal?.current ?? null;
  const summary = history?.summary ?? null;
  const throttleNow = thermal?.throttled.now ?? [];
  const throttleBoot = thermal?.throttled.since_boot ?? [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 stagger">
      <DashboardNav title="Thermal" pickNode />

      {error && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {thermal?.node ?? "…"} · enclosure:{" "}
          <span className="text-foreground">{thermal?.enclosure || "not set (THERMAL_ENCLOSURE)"}</span>
          {thermal && <> · sample every {thermal.interval_s}s · since {thermal.running_since.replace("T", " ")}</>}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 card p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.minutes}
                onClick={() => setMinutes(w.minutes)}
                className={`rounded-lg px-3 py-1.5  text-xs  first-letter:uppercase transition-colors ${
                  minutes === w.minutes ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <a
            href={thermalCsvUrl(minutes)}
            className="rounded-full border border-border px-3 py-2 text-xs text-muted first-letter:uppercase transition-colors hover:border-accent hover:text-foreground"
          >
            CSV
          </a>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="SoC now" value={fmt(now?.soc_temp_c, "°C")} color={tempColor(now?.soc_temp_c, soft)} />
        <Tile label={`Peak (${WINDOWS.find((w) => w.minutes === minutes)?.label})`} value={fmt(summary?.temp_max_c, "°C")} color={tempColor(summary?.temp_max_c, soft)} hint={summary ? `avg ${fmt(summary.temp_avg_c, "°C")}` : undefined} />
        <Tile label="Fan" value={now?.fan_rpm == null ? "–" : `${now.fan_rpm} rpm`} />
        <Tile label="CPU clock" value={now?.cpu_mhz == null ? "–" : `${now.cpu_mhz} MHz`} />
        <Tile label="Detect FPS" value={fmt(now?.detect_fps, "")} />
        <Tile
          label="Soak verdict"
          value={summary ? (summary.pass ? "PASS" : "FAIL") : "–"}
          color={summary ? (summary.pass ? "var(--accent)" : "var(--danger)") : undefined}
          hint={summary ? `${summary.throttled_samples} throttled / ${summary.samples} samples` : undefined}
        />
      </div>

      <Chart samples={history?.samples ?? []} soft={soft} hard={hard} />

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="card px-4 py-3 text-xs">
          <p className="mb-1 text-muted first-letter:uppercase">Throttling now</p>
          <p style={{ color: throttleNow.length ? "var(--danger)" : "var(--accent)" }}>
            {throttleNow.length ? throttleNow.join(", ") : "none"}
          </p>
        </div>
        <div className="card px-4 py-3 text-xs">
          <p className="mb-1 text-muted first-letter:uppercase">Since boot ({thermal?.throttled.hex ?? "–"})</p>
          <p style={{ color: throttleBoot.length ? AMBER : "var(--accent)" }}>
            {throttleBoot.length ? throttleBoot.join(", ") : "none"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Pass = the window never reached {soft}°C and never throttled. Under-voltage counts as a
        throttle flag: it means the power supply, not the enclosure, needs fixing.
      </p>
    </div>
  );
}
