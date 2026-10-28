import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { secret }. Removes the presence row and any pending
// signals to/from this user. Called via navigator.sendBeacon on tab close, so
// the body may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  let secret: unknown;
  try {
    const text = await request.text();
    secret = text ? JSON.parse(text)?.secret : undefined;
  } catch {
    secret = undefined;
  }

  // sendBeacon can't set headers, so the secret travels in the body.
  const id = publicId(secret);
  if (!id) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  // Independent cleanup deletes — no atomicity needed (and interactive
  // transactions are unreliable over a PgBouncer pooler).
  await prisma.signal.deleteMany({
    where: { OR: [{ toId: id }, { fromId: id }] },
  });
  await prisma.presence.deleteMany({ where: { id } });

  return Response.json({ ok: true });
}
