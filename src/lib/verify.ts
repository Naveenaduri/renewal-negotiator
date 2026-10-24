// Server only. The Verifier: it re-fetches each receipt's source and checks the claimed
// prices against the page text in code, so the "verified" badge never rests on a model saying yes.
import { cancelAgent } from "./omnara";
import { scrapePage } from "./contextdev";
import { supabaseAdmin } from "./supabase-admin";

const RUN_TIMEOUT_MS = 60 * 60_000; // absolute cap, includes time spent in review
const INACTIVITY_MS = 6 * 60_000; // the agent should write something at least this often while running

export function extractAmounts(claim: string): string[] {
  const out = new Set<string>();
  for (const m of claim.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g)) {
    out.add(m[1].replace(/,/g, "") + (m[2] && Number(m[2]) !== 0 ? "." + m[2] : ""));
  }
  return [...out];
}

// True when every dollar amount in the claim appears on the fetched page.
export function claimMatchesPage(claim: string, pageText: string): boolean {
  const amounts = extractAmounts(claim);
  if (amounts.length === 0) return false;
  const normalized = pageText.replace(/,/g, "");
  return amounts.every((a) => {
    const [whole, frac] = a.split(".");
    const pattern = frac ? `\\$\\s?${whole}\\.${frac}` : `\\$\\s?${whole}(?:\\.00?)?(?!\\d)`;
    return new RegExp(pattern).test(normalized);
  });
}

async function step(runId: string, kind: string, text: string) {
  await supabaseAdmin().from("run_steps").insert({ run_id: runId, lane: "verifier", kind, text });
}

async function ensureBucket() {
  const sb = supabaseAdmin();
  const { error } = await sb.storage.createBucket("receipts", { public: true });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
}

async function storeScreenshot(runId: string, receiptId: number, dataUri: string): Promise<string | null> {
  const m = dataUri.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return null;
  const sb = supabaseAdmin();
  const path = `${runId}/${receiptId}.png`;
  const { error } = await sb.storage.from("receipts").upload(path, Buffer.from(m[2], "base64"), {
    contentType: m[1],
    upsert: true,
  });
  if (error) return null;
  return sb.storage.from("receipts").getPublicUrl(path).data.publicUrl;
}

type Judge = { email?: string; outcome?: string; counter?: string; counter_reply?: string; est_saving?: number; claims?: { text: string; receipt: string }[] };

export async function finalizeRun(runId: string): Promise<string> {
  const sb = supabaseAdmin();
  // Claim the work. Only one caller wins, so browser polling and the server watcher never double up.
  const { data: claimed } = await sb.from("runs").update({ status: "verifying" }).eq("id", runId).eq("status", "agent_done").select("id, deal_id");
  if (!claimed?.length) return "skipped";
  const dealId = claimed[0].deal_id as string;

  try {
    await step(runId, "start", "Checking every price claim against its saved source.");
    await ensureBucket();
    const { data: receipts } = await sb.from("receipts").select("id, claim, source_url").eq("run_id", runId).order("id");
    const verifiedByLabel = new Map<string, boolean>();

    // Fetch each distinct source page once (receipts often share a page), retrying a failure once.
    const urls = [...new Set((receipts ?? []).map((r) => r.source_url as string))];
    const pages = new Map<string, { markdown: string | null; screenshot: string | null }>();
    const fetchOnce = async (url: string) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const p = await scrapePage(url, { screenshot: true, maxAgeMs: 0 });
          if (p.markdown) return { markdown: p.markdown, screenshot: p.screenshot };
        } catch {
          // fall through to the retry
        }
        await new Promise((res) => setTimeout(res, 1200));
      }
      return { markdown: null, screenshot: null };
    };
    for (let i = 0; i < urls.length; i += 3) {
      await Promise.all(urls.slice(i, i + 3).map(async (u) => pages.set(u, await fetchOnce(u))));
    }

    for (const [i, r] of (receipts ?? []).entries()) {
      const label = `R${i + 1}`;
      const page = pages.get(r.source_url);
      const ok = !!page?.markdown && claimMatchesPage(r.claim ?? "", page.markdown);
      const shot = page?.screenshot ? await storeScreenshot(runId, r.id, page.screenshot) : null;
      verifiedByLabel.set(label, ok);
      await sb.from("receipts").update({ verified: ok, screenshot_url: shot, fetched_at: new Date().toISOString() }).eq("id", r.id);
      await step(runId, "note", ok ? `${label} verified against ${new URL(r.source_url).host}` : page?.markdown ? `${label}: the price was not found on the page, so it is flagged` : `${label}: the page could not be fetched, so it is flagged`);
    }

    const { data: judgeRows } = await sb.from("messages").select("text").eq("run_id", runId).eq("role", "judge").eq("round", 0).order("id", { ascending: false }).limit(1);
    let judge: Judge = {};
    try {
      judge = JSON.parse(judgeRows?.[0]?.text ?? "{}");
    } catch {
      judge = {};
    }
    const claims = judge.claims ?? [];
    const good = claims.filter((c) => verifiedByLabel.get(c.receipt)).length;
    const saving = good > 0 && Number(judge.est_saving) > 0 ? Number(judge.est_saving) : 0;

    await sb.from("deals").update({ est_saving: saving, status: "ready" }).eq("id", dealId);
    await step(runId, "done", `${good} of ${claims.length} claims verified.`);
    await sb.from("runs").update({ status: "complete" }).eq("id", runId);
    return "complete";
  } catch (e) {
    await step(runId, "error", "Verification hit an error. The email is shown with its claims unchecked.");
    await sb.from("runs").update({ status: "complete" }).eq("id", runId);
    return e instanceof Error ? e.message : "error";
  }
}

async function agentIdFor(runId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("run_steps").select("text").eq("run_id", runId).eq("kind", "agent").limit(1);
  return data?.[0]?.text?.replace(/^agent:/, "") ?? null;
}

// Cancels a run that has been going too long and marks it failed, so nothing runs up cost unattended.
export async function reapIfStale(runId: string): Promise<boolean> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("runs").select("status, created_at").eq("id", runId).single();
  if (!data || !["queued", "running"].includes(data.status)) return false;
  // Time spent waiting for a human does not count: judge by the agent's last sign of life.
  const { data: last } = await sb.from("run_steps").select("created_at").eq("run_id", runId).order("id", { ascending: false }).limit(1);
  const lastActivity = new Date(last?.[0]?.created_at ?? data.created_at).getTime();
  const tooQuiet = Date.now() - lastActivity > INACTIVITY_MS;
  const tooOld = Date.now() - new Date(data.created_at).getTime() > RUN_TIMEOUT_MS;
  if (!tooQuiet && !tooOld) return false;
  const agent = await agentIdFor(runId);
  if (agent) await cancelAgent(agent).catch(() => {});
  await sb.from("run_steps").insert({ run_id: runId, lane: "judge", kind: "error", text: "This run took too long and was stopped. Please try again." });
  await sb.from("runs").update({ status: "failed" }).eq("id", runId);
  return true;
}

export { agentIdFor };

// Server-side watcher: keeps going after the browser closes, until the agent hands over.
export async function watchRun(runId: string, maxMs = 280_000): Promise<void> {
  const sb = supabaseAdmin();
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 3000));
    const { data } = await sb.from("runs").select("status").eq("id", runId).single();
    const status = data?.status;
    if (status === "agent_done") {
      await finalizeRun(runId);
      return;
    }
    if (!status || ["complete", "failed", "verifying"].includes(status)) return;
    if (await reapIfStale(runId)) return;
  }
}
