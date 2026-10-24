import { after } from "next/server";
import { launchMessage } from "@/lib/agent/instruction";
import { LimitError, checkLimits } from "@/lib/limits";
import { launchAgent } from "@/lib/omnara";
import { supabaseAdmin, userFromRequest } from "@/lib/supabase-admin";
import { watchRun } from "@/lib/verify";
import { suggestedVendorEmail } from "@/lib/desk";

export const maxDuration = 300;

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Starts a rehearsal. Returns immediately; the agent keeps working on Omnara's servers
// and the page watches Supabase.
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return json({ error: "Please refresh the page and try again. Your guest session did not start." }, 401);

  let email = "";
  let review = true;
  let vendorEmail = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim();
    review = body.review !== false;
    vendorEmail = String(body.vendorEmail ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "That request did not look right. Please try again." }, 400);
  }
  if (email.length < 30) return json({ error: "Paste the full renewal or quote email (a few sentences at least)." }, 400);
  if (email.length > 8000) return json({ error: "That email is too long. Paste just the renewal notice, under 8,000 characters." }, 400);

  // Who plays the vendor. It must differ from the signed-in user, and guests may only use the suggested address.
  const suggested = suggestedVendorEmail();
  const vendor = vendorEmail || suggested;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(vendor)) return json({ error: "Enter the email address of the person playing the vendor." }, 400);
  const { data: who } = await supabaseAdmin().auth.admin.getUserById(user.id);
  const me = who.user;
  if (me && !me.is_anonymous && me.email?.toLowerCase() === vendor) {
    return json({ error: "The vendor and you cannot be the same address. Use a different inbox for the vendor." }, 400);
  }
  const guestOk = vendor === suggested || vendor.endsWith("@vast-crane.primitive.email") || (process.env.GUEST_VENDOR_ALLOW ?? "").toLowerCase().split(",").map((x) => x.trim()).includes(vendor);
  if (me?.is_anonymous && !guestOk) {
    return json({ error: "Sign in to choose a different vendor address." }, 403);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  try {
    await checkLimits(user.id, ip);
  } catch (e) {
    if (e instanceof LimitError) return json({ error: e.message }, 429);
    return json({ error: "Something went wrong on our side. Please try again." }, 500);
  }

  const sb = supabaseAdmin();
  const { data: deal, error: dealErr } = await sb.from("deals").insert({ user_id: user.id, status: "new" }).select("id").single();
  if (dealErr || !deal) return json({ error: "We could not save your deal. Please try again." }, 500);
  const { data: run, error: runErr } = await sb.from("runs").insert({ deal_id: deal.id, user_id: user.id, status: "queued" }).select("id").single();
  if (runErr || !run) return json({ error: "We could not start the run. Please try again." }, 500);

  await sb.from("run_steps").insert([
    { run_id: run.id, lane: "system", kind: "vendor", text: vendor },
    { run_id: run.id, lane: "system", kind: "note", text: "Rehearsal queued. Starting your agent crew." },
  ]);

  try {
    const agentId = await launchAgent(`rehearsal-${run.id.slice(0, 8)}`, launchMessage({ runId: run.id, dealId: deal.id, email, mode: review ? "review" : "autopilot" }));
    await sb.from("run_steps").insert({ run_id: run.id, lane: "system", kind: "agent", text: `agent:${agentId}` });
    await sb.from("runs").update({ status: "running" }).eq("id", run.id).eq("status", "queued");
  } catch (e) {
    console.error("launch failed", e);
    await sb.from("run_steps").insert({ run_id: run.id, lane: "system", kind: "error", text: "The agent crew could not start." });
    await sb.from("runs").update({ status: "failed" }).eq("id", run.id);
    return json({ error: "The agents could not start just now. Please try again in a moment.", runId: run.id }, 502);
  }

  after(() => watchRun(run.id));
  return json({ runId: run.id });
}
