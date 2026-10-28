import { createHash } from "node:crypto";

// Each browser holds a random secret (a UUID) that never leaves its own
// requests. The public id other users see is sha256(secret), so knowing
// someone's id does not let you poll, signal or leave as them.
const SECRET_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PUBLIC_ID_RE = /^[0-9a-f]{64}$/;

export function publicId(secret: unknown): string | null {
  if (typeof secret !== "string" || !SECRET_RE.test(secret)) return null;
  return createHash("sha256").update(secret.toLowerCase()).digest("hex");
}

// Caller identity from `Authorization: Bearer <secret>`.
export function callerId(request: Request): string | null {
  const auth = request.headers.get("authorization");
  return publicId(auth?.startsWith("Bearer ") ? auth.slice(7) : null);
}
