import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import { callerId } from "@/lib/session";
import type { PollResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REAP_SAMPLE_RATE = 0.2;
// shortcut: no viewport filtering, so past 500 online users some dots are
// missing; upgrade to a bounding-box query when that's a real problem.
const MAX_PEERS = 500;

// GET /api/poll — Authorization: Bearer <secret>. The single endpoint that
// drives the live map. It (1) heartbeats the caller, (2) reaps stale presence
// + orphan signals, (3) returns the filtered online peers, and (4) drains this
// user's mailbox.
export async function GET(request: NextRequest) {
  const id = callerId(request);
  if (!id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  // 1) Heartbeat — refresh lastSeen for the caller.
  await prisma.presence.updateMany({
    where: { id },
    data: { lastSeen: new Date(now) },
  });

  // 2–4 are independent, so run them in parallel (each poll used to make five
  // sequential round trips to the database).
  const [, peers, inbox] = await Promise.all([
    // 2) Reap stale presence rows and orphaned signals. Peers are already
    // filtered by lastSeen below, so this is only cleanup: sample it instead
    // of running two table-wide deletes on every poll from every user.
    Math.random() < REAP_SAMPLE_RATE
      ? Promise.all([
          prisma.presence.deleteMany({ where: { lastSeen: { lt: staleCutoff } } }),
          prisma.signal.deleteMany({ where: { createdAt: { lt: signalCutoff } } }),
        ])
      : null,
    // 3) Online peers, excluding self. Capped so one response can't grow
    // without bound.
    prisma.presence.findMany({
      where: {
        id: { not: id },
        lastSeen: { gte: staleCutoff },
      },
      select: { id: true, lat: true, lng: true, busy: true },
      take: MAX_PEERS,
    }),
    // 4) Drain this user's mailbox: read, then delete exactly what we read so
    // a concurrently-inserted signal is never lost.
    prisma.signal.findMany({
      where: { toId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (inbox.length > 0) {
    await prisma.signal.deleteMany({
      where: { id: { in: inbox.map((s) => s.id) } },
    });
  }

  const response: PollResponse = {
    peers: peers.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      busy: p.busy,
    })),
    signals: inbox.map((s) => ({
      id: s.id,
      fromId: s.fromId,
      toId: s.toId,
      type: s.type as PollResponse["signals"][number]["type"],
      payload: s.payload,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return Response.json(response);
}
