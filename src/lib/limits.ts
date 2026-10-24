// Server only. Per-user and per-IP limits plus a global cap on concurrent runs.
import { supabaseAdmin } from "./supabase-admin";

const PER_USER_PER_HOUR = 6;
const PER_IP_PER_HOUR = 12;
const MAX_ACTIVE_RUNS = 8;

const ipHits = new Map<string, number[]>();

export class LimitError extends Error {}

export async function checkLimits(userId: string, ip: string): Promise<void> {
  const now = Date.now();
  const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_IP_PER_HOUR) {
    throw new LimitError("That is a lot of runs from one network in the last hour. Please try again a bit later.");
  }
  recent.push(now);
  ipHits.set(ip, recent);

  const sb = supabaseAdmin();
  const hourAgo = new Date(now - 3_600_000).toISOString();
  const { count: mine } = await sb.from("runs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", hourAgo);
  if ((mine ?? 0) >= PER_USER_PER_HOUR) {
    throw new LimitError(`You have used your ${PER_USER_PER_HOUR} rehearsals for this hour. Try again in a little while.`);
  }
  const { count: active } = await sb
    .from("runs")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "running", "awaiting_approval", "agent_done", "verifying"])
    .gte("created_at", new Date(now - 15 * 60_000).toISOString());
  if ((active ?? 0) >= MAX_ACTIVE_RUNS) {
    throw new LimitError("The rehearsal room is full right now. Please try again in a minute.");
  }
}
