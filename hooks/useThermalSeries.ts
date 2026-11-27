"use client";

import { useEffect, useState } from "react";
import { createApi, type ThermalSample } from "@/lib/api";

const REFRESH_MS = 30_000;

/**
 * Each node's recent temperature and detection-rate history. A node that
 * cannot answer keeps what it last sent; one that never answers is absent.
 */
export function useThermalSeries(nodeIds: string[], minutes: number) {
  const [series, setSeries] = useState<Record<string, ThermalSample[]>>({});
  const key = nodeIds.join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    const load = () =>
      Promise.allSettled(
        key.split(",").map(async (id) => {
          const history = await createApi(id).getThermalHistory(minutes);
          if (!cancelled) {
            setSeries((current) => ({ ...current, [id]: history.samples }));
          }
        }),
      );

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key, minutes]);

  return series;
}
