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
    const pages = new Map<string, { markdown: string | null; screenshot: string | null; fetchedAt: string | null }>();
    const fetchOnce = async (url: string) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const p = await scrapePage(url, { screenshot: true, maxAgeMs: 6 * 60 * 60 * 1000 });
          if (p.markdown) return { markdown: p.markdown, screenshot: p.screenshot, fetchedAt: p.fetchedAt };
        } catch {
          // fall through to the retry
        }
        await new Promise((res) => setTimeout(res, 1200));
      }
      return { markdown: null, screenshot: null, fetchedAt: null };
    };
    for (let i = 0; i < urls.length; i += 2) {
      await Promise.all(urls.slice(i, i + 2).map(async (u) => pages.set(u, await fetchOnce(u))));
    }

    for (const [i, r] of (receipts ?? []).entries()) {
      const label = `R${i + 1}`;
      const page = pages.get(r.source_url);
      const ok = !!page?.markdown && claimMatchesPage(r.claim ?? "", page.markdown);
      const shot = page?.screenshot ? await storeScreenshot(runId, r.id, page.screenshot) : null;
      verifiedByLabel.set(label, ok);
      await sb.from("receipts").update({ verified: ok, screenshot_url: shot, fetched_at: page?.fetchedAt ?? new Date().toISOString() }).eq("id", r.id);
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
// Capture a receipt's screenshot as soon as the agent records it, so the page shows the
// source while research is still going (the Verifier re-checks everything at the end).
function screenshotter(runId: string) {
  const sb = supabaseAdmin();
  const started = new Set<string>(); // source URLs being captured right now
  const tries = new Map<string, number>(); // capped so a failing page cannot burn credits
  let bucket: Promise<void> | null = null;
  let active = 0;
  const queue: string[] = [];
  const pump = () => {
    while (active < 2 && queue.length) { // context.dev free plan: 2 concurrent requests
      const url = queue.shift()!;
      active++;
      (async () => {
        try {
          bucket ??= ensureBucket();
          await bucket;
          const p = await scrapePage(url, { screenshot: true, maxAgeMs: 6 * 60 * 60 * 1000 });
          if (!p.screenshot) return;
          const { data: rows } = await sb.from("receipts").select("id").eq("run_id", runId).eq("source_url", url).is("screenshot_url", null);
          for (const r of rows ?? []) {
            const shot = await storeScreenshot(runId, r.id, p.screenshot);
            if (shot) await sb.from("receipts").update({ screenshot_url: shot, fetched_at: p.fetchedAt }).eq("id", r.id);
          }
        } catch {
          // best effort; the Verifier captures it at the end
        } finally {
          active--;
          started.delete(url); // a later receipt on the same page gets its own pass
          pump();
        }
      })();
    }
  };
  return async () => {
    const { data } = await sb.from("receipts").select("source_url").eq("run_id", runId).is("screenshot_url", null);
    for (const u of new Set((data ?? []).map((r) => r.source_url as string))) {
      const n = tries.get(u) ?? 0;
      if (!started.has(u) && n < 3) { started.add(u); tries.set(u, n + 1); queue.push(u); }
    }
    pump();
  };
}

export async function watchRun(runId: string, maxMs = 280_000): Promise<void> {
  const sb = supabaseAdmin();
  const end = Date.now() + maxMs;
  const captureNew = screenshotter(runId);
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 2000));
    await captureNew().catch(() => {});
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

// Each run's agent keeps a pooled sandbox while it waits for objections. Release the ones from
// runs that finished 45 minutes to 3 hours ago, so the pool never fills up (archiving is idempotent).
// Runs still waiting on a real vendor reply are left alone.
export async function archiveOldAgents(): Promise<void> {
  const sb = supabaseAdmin();
  const now = Date.now();
  const { data: runs } = await sb
    .from("runs")
    .select("id")
    .in("status", ["complete", "failed", "deal_done"])
    .gte("created_at", new Date(now - 3 * 60 * 60 * 1000).toISOString())
    .lte("created_at", new Date(now - 45 * 60 * 1000).toISOString())
    .limit(50);
  if (!runs?.length) return;
  const { data: steps } = await sb.from("run_steps").select("text").eq("kind", "agent").in("run_id", runs.map((r) => r.id));
  const { archiveAgent } = await import("@/lib/omnara");
  await Promise.allSettled((steps ?? []).map((s) => archiveAgent(String(s.text).replace(/^agent:/, ""))));
}
