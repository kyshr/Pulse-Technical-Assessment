// Client-side helpers for talking to the coordination API. `secret` is this
// tab's private session secret; the server derives our public id from it.
import type { PollResponse, SignalType } from "@/lib/types";

export async function join(
  secret: string,
  lat: number,
  lng: number,
): Promise<void> {
  await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, lat, lng }),
  });
}

export async function poll(secret: string): Promise<PollResponse> {
  const res = await fetch("/api/poll", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  secret: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  await fetch("/api/signal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ toId, type, payload }),
  });
}

// Fire-and-forget leave that survives the tab closing.
export function leave(secret: string): void {
  const body = JSON.stringify({ secret });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
