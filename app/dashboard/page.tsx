"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError, type DetectionEvent, type LabelPayload } from "@/lib/api";
import { StatusStrip } from "@/components/StatusStrip";
import { EventList } from "@/components/EventList";
import { EventDetailPanel } from "@/components/EventDetailPanel";
import { TestOfflineToggle } from "@/components/dev/TestOfflineToggle"; // TEST ONLY — remove before final build

export default function DashboardPage() {
  const { status, logout } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false); // TEST ONLY — remove before final build

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    api
      .getEvents()
      .then((data) => {
        if (cancelled) return;
        setEvents(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Failed to load events");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  async function handleLabel(id: number, payload: LabelPayload) {
    await api.labelEvent(id, payload);
    setEvents((prev) =>
      prev.map((event) =>
        event.id === id
          ? {
              ...event,
              confirmed: payload.action === "confirm" ? 1 : event.confirmed,
              label:
                payload.action === "correct" && payload.label
                  ? payload.label
                  : event.label,
            }
          : event,
      ),
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          {status === "loading" ? "Checking session…" : "Redirecting…"}
        </p>
      </div>
    );
  }

  const selectedEvent = events.find((event) => event.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-1 flex-col px-6 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-muted uppercase">
            ARGUS
          </p>
          <h1 className="mt-1 text-lg font-medium text-foreground">
            Security console
          </h1>
        </div>
        <button
          onClick={() => logout().then(() => router.replace("/login"))}
          className="rounded border border-border px-3 py-2 font-mono text-xs tracking-[0.2em] text-muted uppercase transition-colors hover:border-accent hover:text-foreground"
        >
          Log out
        </button>
      </header>

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-[240px] flex-1">
          <StatusStrip forceOffline={simulateOffline} />
        </div>
        {/* TEST ONLY — remove before final build */}
        <TestOfflineToggle active={simulateOffline} onToggle={setSimulateOffline} />
      </div>

      {simulateOffline && (
        <div className="mb-6 rounded border border-danger/30 bg-danger/10 px-4 py-3 font-mono text-xs text-danger">
          ⚠ Live connection lost — showing last known data only.
        </div>
      )}

      {loadError && (
        <div className="mb-6 rounded border border-danger/30 bg-danger/10 px-4 py-3 font-mono text-xs text-danger">
          {loadError}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-h-[420px]">
          {loading ? (
            <div className="flex h-full items-center justify-center rounded border border-border bg-surface">
              <p className="font-mono text-xs tracking-widest text-muted uppercase">
                Loading events…
              </p>
            </div>
          ) : (
            <EventList
              events={events}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
        <div className="min-h-[420px]">
          <EventDetailPanel event={selectedEvent} onLabel={handleLabel} />
        </div>
      </div>
    </div>
  );
}
