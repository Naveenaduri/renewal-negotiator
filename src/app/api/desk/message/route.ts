import { BOXES, deskOk, denied } from "@/lib/desk";
import { getEmail } from "@/lib/primitive";

// One message with its body. Only the two demo mailboxes can be read.
export async function GET(req: Request) {
  if (!deskOk(req)) return denied();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{20,}$/i.test(id)) return Response.json({ error: "Bad message id." }, { status: 400 });
  try {
    const m = await getEmail(id);
    if (!Object.values<string>(BOXES).includes(m.to)) return Response.json({ error: "Not found." }, { status: 404 });
    return Response.json(m);
  } catch (e) {
    console.error("desk read failed", e);
    return Response.json({ error: "Could not open that message." }, { status: 502 });
  }
}
