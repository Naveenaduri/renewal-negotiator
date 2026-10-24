import { BOXES, boxOf, deskOk, denied } from "@/lib/desk";
import { listInbound } from "@/lib/primitive";

// Newest first: what has arrived at one demo mailbox.
export async function GET(req: Request) {
  if (!deskOk(req)) return denied();
  const box = boxOf(new URL(req.url).searchParams.get("box"));
  if (!box) return Response.json({ error: "Unknown mailbox." }, { status: 400 });
  try {
    const rows = await listInbound(60);
    const mine = rows.filter((r) => r.to === BOXES[box]).map((r) => ({ id: r.id, from: r.sender, subject: r.subject, at: r.received_at, snippet: r.snippet ?? "" }));
    return Response.json({ address: BOXES[box], messages: mine });
  } catch (e) {
    console.error("desk list failed", e);
    return Response.json({ error: "Could not load the mailbox just now." }, { status: 502 });
  }
}
