export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatTimeShort(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

/** The time, with the date in front when it was not today. */
export function formatWhen(ts: string): string {
  const at = new Date(ts);
  if (at.toDateString() === new Date().toDateString()) return formatTimeShort(ts);
  const day = at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day}, ${formatTimeShort(ts)}`;
}

/** A node timestamp, in seconds since the epoch. */
export function formatEpoch(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const WARN_C = 70;
export const AMBER = "#e3b341";

/** SoC temperature colour: over the node's soft limit is the alarm case. */
export function tempColor(temp: number | null | undefined, soft: number): string {
  if (temp == null) return "var(--muted)";
  if (temp >= soft) return "var(--danger)";
  if (temp >= WARN_C) return AMBER;
  return "var(--accent)";
}
