import { API_BASE_URL, WS_EVENTS_URL } from "./config";

// Shapes match the FastAPI contract in CLAUDE.md — keep in sync with
// Mohammed's backend once it exists for real.

export interface StatusResponse {
  fps: number;
  accelerator: string;
  model_version: string;
  nodes_online: number;
}

export type DetectionClass = "person" | "vehicle" | "package" | "animal";
export type DetectionStatus = "member" | "stranger" | "na";

export interface DetectionEvent {
  id: number;
  cls: DetectionClass;
  zone: string;
  node: string;
  ts: string;
  status: DetectionStatus;
  label: string;
  confidence: number;
  confirmed: number;
}

export type LabelAction = "confirm" | "correct";

export interface LabelPayload {
  action: LabelAction;
  label?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(`Cannot reach backend at ${API_BASE_URL}`, 0);
  }

  if (!res.ok) {
    throw new ApiError(`${path} failed: ${res.status}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getStatus: () => apiFetch<StatusResponse>("/api/status"),

  getEvents: () => apiFetch<DetectionEvent[]>("/api/events"),

  labelEvent: (id: number, payload: LabelPayload) =>
    apiFetch<void>(`/api/events/${id}/label`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

/**
 * Opens the live event feed. Backend push shape is identical to a
 * DetectionEvent record (see CLAUDE.md).
 */
export function connectEventsSocket(
  onEvent: (event: DetectionEvent) => void,
  onError?: (event: Event) => void,
): WebSocket {
  const socket = new WebSocket(WS_EVENTS_URL);

  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as DetectionEvent);
    } catch {
      // ignore malformed frames rather than crash the feed
    }
  };

  if (onError) socket.onerror = onError;

  return socket;
}
