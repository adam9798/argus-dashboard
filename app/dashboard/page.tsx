"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useNodes } from "@/hooks/useNodes";
import { useThermalSeries } from "@/hooks/useThermalSeries";
import { DashboardNav } from "@/components/DashboardNav";
import { NodePanel, type NodeReport } from "@/components/NodePanel";
import { Sparkline, StatCard } from "@/components/overview/StatCard";
import { TemperatureChart } from "@/components/overview/TemperatureChart";
import { RecentAlerts, type NodeAlert } from "@/components/overview/RecentAlerts";
import { TrainingTools } from "@/components/overview/TrainingTools";
import type { DetectionEvent, ThermalSample } from "@/lib/api";
import { downsample, type Sample } from "@/lib/chart";
import { tempColor } from "@/lib/format";

const HISTORY_MINUTES = 60;
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

/** One reading per history sample that has it. */
function readings(
  samples: ThermalSample[] | undefined,
  field: "soc_temp_c" | "detect_fps",
): Sample[] {
  return (samples ?? []).flatMap((s) => {
    const v = s[field];
    return v === null || v === undefined ? [] : [{ t: s.ts, v }];
  });
}

/** Combines the nodes' trends position by position, newest ends aligned. */
function combine(lines: number[][], how: (values: number[]) => number): number[] {
  const usable = lines.filter((line) => line.length > 1);
  if (usable.length === 0) return [];
  const length = Math.min(...usable.map((line) => line.length));
  return Array.from({ length }, (_, i) =>
    how(usable.map((line) => line[line.length - length + i])),
  );
}

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// Every configured node on one screen. The single-node pages (live,
// alerts, thermal) still follow the node picker; this one ignores it.
export default function DashboardPage() {
  const { status } = useAuth();
  const router = useRouter();
  const { nodes, selected, loaded } = useNodes();
  const [health, setHealth] = useState<Record<string, NodeReport>>({});
  const [feeds, setFeeds] = useState<Record<string, DetectionEvent[]>>({});

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const onHealth = useCallback((nodeId: string, report: NodeReport | null) => {
    setHealth((prev) => {
      const next = { ...prev };
      if (report) next[nodeId] = report;
      else delete next[nodeId];
      return next;
    });
  }, []);

  const onEvents = useCallback((nodeId: string, events: DetectionEvent[] | null) => {
    setFeeds((prev) => {
      const next = { ...prev };
      if (events) next[nodeId] = events;
      else delete next[nodeId];
      return next;
    });
  }, []);

  const online = nodes.filter((node) => health[node.id]?.state === "online");
  const history = useThermalSeries(
    online.map((node) => node.id),
    HISTORY_MINUTES,
  );

  const alerts: NodeAlert[] = useMemo(
    () =>
      nodes
        .flatMap((node) =>
          (feeds[node.id] ?? [])
            .filter((event) => event.status === "stranger" && !event.confirmed)
            .map((event) => ({ nodeId: node.id, nodeName: node.name, event })),
        )
        .sort((a, b) => Date.parse(b.event.ts) - Date.parse(a.event.ts)),
    [nodes, feeds],
  );

  if (status !== "authenticated") {
    return (
      <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-8">
        <p className="sr-only">
          {status === "loading" ? "Checking session…" : "Redirecting…"}
        </p>
        <div className="skeleton mb-6 h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      </div>
    );
  }

  const speeds = online.flatMap((node) => health[node.id]?.fps ?? []);
  const hottest = online
    .map((node) => ({ name: node.name, ...health[node.id] }))
    .filter((node) => node.temp !== null)
    .sort((a, b) => (b.temp as number) - (a.temp as number))[0];

  const trend = (field: "soc_temp_c" | "detect_fps") =>
    online.map((node) =>
      downsample(readings(history[node.id], field), 30).map((s) => s.v),
    );

  // How many alerts each node is holding: the bars under the alert count.
  const perNode = nodes.map(
    (node) => alerts.filter((alert) => alert.nodeId === node.id).length,
  );
  const most = Math.max(1, ...perNode);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-1 flex-col px-4 py-6 sm:px-8">
      {/* The Alerts link opens the picked node, so its badge counts that node. */}
      <DashboardNav
        title="Security Overview"
        alertCount={alerts.filter((alert) => alert.nodeId === selected).length}
      />

      {nodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted">
            {loaded ? "Could not load the node list" : "Loading nodes…"}
          </p>
        </div>
      ) : (
        // Phones put the cameras first; wide screens open with the summary.
        <div className="flex flex-col gap-4 lg:gap-6">
          <div className="order-2 grid grid-cols-2 gap-3 lg:order-1 lg:grid-cols-4 lg:gap-4">
            <StatCard
              label="Nodes online"
              value={online.length}
              suffix={`/${nodes.length}`}
              hint={
                online.length === nodes.length
                  ? "All answering"
                  : `${nodes.length - online.length} not online`
              }
              visual={
                <div className="flex h-full items-end justify-end gap-1.5">
                  {nodes.map((node) => (
                    <span
                      key={node.id}
                      title={`${node.name}: ${health[node.id]?.state ?? "connecting"}`}
                      className={`w-4 rounded-md transition-all duration-300 ${
                        health[node.id]?.state === "online"
                          ? "h-full bg-success/80"
                          : "h-1/3 bg-border"
                      }`}
                    />
                  ))}
                </div>
              }
            />
            <StatCard
              label="Alerts to review"
              value={alerts.length}
              color={alerts.length > 0 ? "var(--danger)" : undefined}
              hint="In each node's latest events"
              href="/dashboard/alerts"
              delay={50}
              visual={
                <div className="flex h-full items-end justify-end gap-1.5">
                  {nodes.map((node, i) => (
                    <span
                      key={node.id}
                      title={`${node.name}: ${perNode[i]}`}
                      className={`w-4 rounded-md transition-all duration-300 ${
                        perNode[i] > 0 ? "bg-danger/80" : "bg-border"
                      }`}
                      style={{ height: `${Math.max(8, (perNode[i] / most) * 100)}%` }}
                    />
                  ))}
                </div>
              }
            />
            <StatCard
              label="Detection speed"
              value={speeds.length ? average(speeds) : null}
              digits={1}
              suffix="fps"
              hint="Average of online nodes"
              delay={100}
              visual={<Sparkline values={combine(trend("detect_fps"), average)} />}
            />
            <StatCard
              label="Hottest node"
              value={hottest?.temp ?? null}
              digits={1}
              suffix="°C"
              color={
                hottest && (hottest.temp as number) >= 70
                  ? tempColor(hottest.temp, hottest.softLimit)
                  : undefined
              }
              hint={hottest ? `${hottest.name}, limit ${hottest.softLimit}°` : "No reading"}
              href="/dashboard/thermal"
              delay={150}
              visual={
                <Sparkline values={combine(trend("soc_temp_c"), (v) => Math.max(...v))} />
              }
            />
          </div>

          <div className="order-1 grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-4 lg:order-2">
            {nodes.map((node, i) => (
              <NodePanel
                key={node.id}
                node={node}
                delay={i * 60}
                onHealth={onHealth}
                onEvents={onEvents}
              />
            ))}
          </div>

          <div className="order-3 grid grid-cols-1 items-start gap-4 xl:grid-cols-[3fr_2fr]">
            <section className="card rise min-w-0 p-4 sm:p-5">
              <TemperatureChart
                series={nodes.map((node, i) => ({
                  id: node.id,
                  name: node.name,
                  // By position in the full list: a node keeps its colour.
                  color: SERIES[i % SERIES.length],
                  samples: downsample(readings(history[node.id], "soc_temp_c"), 90),
                }))}
              />
            </section>
            <section className="card rise min-w-0 p-4 sm:p-5">
              <RecentAlerts alerts={alerts} />
            </section>
          </div>

          <div className="order-4">
            <TrainingTools nodes={nodes} />
          </div>
        </div>
      )}
    </div>
  );
}
