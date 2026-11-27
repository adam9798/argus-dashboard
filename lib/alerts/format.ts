import type { DetectionEvent } from "@/lib/api";
import { localAddresses } from "@/lib/discovery/scan";

// Text-only alert payloads. Proposal CON-2: no thumbnails, frames, crops or
// embeddings leave the property, so a Discord message never carries an image
// or a link to one. Class, zone, node, time and confidence only.

export interface DiscordPayload {
  username: string;
  allowed_mentions: { parse: never[] };
  embeds: Array<{
    title: string;
    color: number;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    timestamp?: string;
    footer: { text: string };
    url?: string;
  }>;
}

const RED = 0xe5484d;
const TEAL = 0x2dd4bf;

/** What the alert says about the class, e.g. "Person". */
function classLabel(event: DetectionEvent): string {
  return event.cls.charAt(0).toUpperCase() + event.cls.slice(1);
}

/**
 * ARGUS_DASHBOARD_URL when set; otherwise this computer's address on the
 * current network, so the link survives a network change.
 */
export function dashboardLink(): string | undefined {
  const set = process.env.ARGUS_DASHBOARD_URL?.trim().replace(/\/+$/, "");
  if (set) return `${set}/dashboard/alerts`;
  const [address] = localAddresses();
  return address
    ? `http://${address}:${process.env.PORT || 3000}/dashboard/alerts`
    : undefined;
}

export function formatAlert(event: DetectionEvent, nodeName: string): DiscordPayload {
  const when = new Date(event.ts);
  const valid = !Number.isNaN(when.getTime());
  return {
    username: "ARGUS",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `Stranger flagged - ${nodeName}`,
        color: RED,
        url: dashboardLink(),
        fields: [
          { name: "Class", value: classLabel(event), inline: true },
          { name: "Zone", value: event.zone || "unknown", inline: true },
          { name: "Confidence", value: `${Math.round(event.confidence)}%`, inline: true },
          { name: "Event", value: `#${event.id}`, inline: true },
          {
            name: "Time",
            value: valid ? when.toLocaleString("en-US", { hour12: false }) : event.ts,
            inline: true,
          },
          { name: "What", value: event.label || "Unusual for this site", inline: false },
        ],
        timestamp: valid ? when.toISOString() : undefined,
        footer: { text: "ARGUS - text only, no images leave the property" },
      },
    ],
  };
}

export function formatTest(): DiscordPayload {
  return {
    username: "ARGUS",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "ARGUS test alert",
        color: TEAL,
        url: dashboardLink(),
        fields: [
          { name: "Status", value: "Discord delivery is working", inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "ARGUS - text only, no images leave the property" },
      },
    ],
  };
}
