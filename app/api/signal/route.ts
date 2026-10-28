import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { callerId, PUBLIC_ID_RE } from "@/lib/session";
import type { SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

const MAX_PAYLOAD = 64 * 1024; // SDP/ICE are small; cap to be safe.
const MAX_PENDING_SIGNALS = 100;
const REQUEST_COOLDOWN_MS = 3_000;

// POST /api/signal — Authorization: Bearer <secret>; body { toId, type, payload? }
// Drops one message into the recipient's mailbox. Also manages the `busy`
// flag so a user can only be in one connection at a time.
export async function POST(request: NextRequest) {
  // The sender is whoever holds the secret, never a client-supplied id.
  const fromId = callerId(request);
  if (!fromId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { toId, type, payload } = (body ?? {}) as Record<string, unknown>;

  if (typeof toId !== "string" || !PUBLIC_ID_RE.test(toId) || toId === fromId) {
    return Response.json({ error: "invalid recipient" }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }
  if (
    payload !== undefined &&
    payload !== null &&
    (typeof payload !== "string" || payload.length > MAX_PAYLOAD)
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const signalType = type as SignalType;
  const payloadStr = typeof payload === "string" ? payload : null;

  const [me, pending] = await Promise.all([
    prisma.presence.findUnique({
      where: { id: fromId },
      select: { busy: true, partnerId: true, lastRequestAt: true },
    }),
    prisma.signal.count({ where: { fromId } }),
  ]);
  if (!me) {
    return Response.json({ error: "unknown session" }, { status: 403 });
  }
  const forbidden = () =>
    Response.json({ error: "not allowed" }, { status: 403 });
  const tooMany = () =>
    Response.json({ error: "slow down" }, { status: 429 });

  // Mailbox flooding: a real call needs a few dozen undelivered signals at most.
  if (pending >= MAX_PENDING_SIGNALS) return tooMany();

  // Connection state machine. partnerId = who you requested (busy=false) or
  // are connected to (busy=true); each signal is only valid for its state.
  switch (signalType) {
    case "request": {
      if (me.busy) return forbidden();
      // Request spam / harassment: one request per cooldown window.
      if (
        me.lastRequestAt &&
        Date.now() - me.lastRequestAt.getTime() < REQUEST_COOLDOWN_MS
      ) {
        return tooMany();
      }
      await prisma.presence.update({
        where: { id: fromId },
        data: { partnerId: toId, lastRequestAt: new Date() },
      });
      // One active connection at a time: auto-decline if the target is
      // offline or busy instead of delivering the request.
      const target = await prisma.presence.findUnique({
        where: { id: toId },
        select: { busy: true },
      });
      if (!target || target.busy) {
        await sendDecline(toId, fromId);
        return Response.json({ ok: true, autoDeclined: true });
      }
      break;
    }
    case "accept": {
      // Only the user who was requested can accept, while both are free.
      if (me.busy) return forbidden();
      const linked = await prisma.presence.updateMany({
        where: { id: toId, partnerId: fromId, busy: false },
        data: { busy: true },
      });
      if (linked.count === 0) return forbidden();
      await prisma.presence.update({
        where: { id: fromId },
        data: { busy: true, partnerId: toId },
      });
      break;
    }
    case "decline": {
      // Only against a pending request to us.
      const cleared = await prisma.presence.updateMany({
        where: { id: toId, partnerId: fromId, busy: false },
        data: { partnerId: null },
      });
      if (cleared.count === 0) return forbidden();
      break;
    }
    case "end": {
      // Either side of a pending or active link can end it; frees both.
      const cleared = await prisma.presence.updateMany({
        where: {
          OR: [
            { id: fromId, partnerId: toId },
            { id: toId, partnerId: fromId },
          ],
        },
        data: { partnerId: null, busy: false },
      });
      if (cleared.count === 0) return forbidden();
      break;
    }
    default:
      // offer / answer / ice: only between connected partners.
      if (!me.busy || me.partnerId !== toId) return forbidden();
  }

  await prisma.signal.create({
    data: { fromId, toId, type: signalType, payload: payloadStr },
  });

  return Response.json({ ok: true });
}

// Helper: deliver an auto-decline from `target` back to `initiator`.
async function sendDecline(targetId: string, initiatorId: string) {
  await prisma.signal.create({
    data: { fromId: targetId, toId: initiatorId, type: "decline", payload: null },
  });
}
