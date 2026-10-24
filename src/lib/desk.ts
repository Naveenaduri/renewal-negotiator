// Server only. The mail desk lets a person read and answer the two demo mailboxes in the browser.
import { timingSafeEqual } from "node:crypto";

export const BOXES = {
  vendor: "vendor@vast-crane.primitive.email",
  buyer: "buyer@vast-crane.primitive.email",
} as const;
export type Box = keyof typeof BOXES;

export function boxOf(v: string | null): Box | null {
  return v === "vendor" || v === "buyer" ? v : null;
}

// A shared passcode keeps strangers out of the demo mailboxes.
export function deskOk(req: Request): boolean {
  const want = process.env.DESK_PASSCODE ?? "";
  const got = req.headers.get("x-desk-passcode") ?? "";
  if (!want || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export const denied = () => Response.json({ error: "Wrong or missing passcode." }, { status: 401 });
