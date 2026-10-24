"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSession, supabaseBrowser } from "@/lib/supabase";

export type Step = { id: number; lane: string; kind: string; text: string; created_at: string };
export type Message = { id: number; role: string; round: number | null; text: string; created_at: string };
export type ReceiptRow = { id: number; claim: string; source_url: string; screenshot_url: string | null; verified: boolean; fetched_at: string };
export type Deal = { id: string; vendor: string | null; product: string | null; price: number | null; renewal_date: string | null; status: string; est_saving: number | null };
export type RunRow = { id: string; status: string; created_at: string; deal_id: string };
export type Offer = {
  kind?: string;
  offer_price_annual?: number | null;
  offer_quote?: string;
  summary?: string;
  leverage?: string;
  suggested_reply?: string;
  accept?: boolean;
};
export type Gate = { gate: string; title?: string; bullets?: string[]; question?: string };
export type Judge = {
  email?: string;
  outcome?: string;
  outcome_chance?: number;
  counter?: string;
  counter_chance?: number;
  counter_reply?: string;
  est_saving?: number;
  saving_basis?: string;
  claims?: { text: string; receipt: string }[];
};

const TERMINAL = ["complete", "failed"];

// Loads one run and keeps it fresh: realtime pushes plus a short poll as a safety net.
// The agents keep working on the server whether or not this page is open.
export function useRun(runId: string) {
  const [run, setRun] = useState<RunRow | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [initialIds, setInitialIds] = useState<Set<number> | null>(null);
  const status = useRef<string>("");

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const [r, s, m, c] = await Promise.all([
      sb.from("runs").select("id, status, created_at, deal_id").eq("id", runId).maybeSingle(),
      sb.from("run_steps").select("*").eq("run_id", runId).order("id"),
      sb.from("messages").select("*").eq("run_id", runId).order("id"),
      sb.from("receipts").select("*").eq("run_id", runId).order("id"),
    ]);
    if (r.error) throw r.error;
    if (!r.data) {
      setError("We could not find that run. It may belong to a different browser session.");
      return;
    }
    setRun(r.data as RunRow);
    status.current = r.data.status;
    setSteps((s.data ?? []) as Step[]);
    setMessages((m.data ?? []) as Message[]);
    setReceipts((c.data ?? []) as ReceiptRow[]);
    setInitialIds((prev) => prev ?? new Set((m.data ?? []).map((x: Message) => x.id)));
    const d = await sb.from("deals").select("*").eq("id", r.data.deal_id).maybeSingle();
    if (d.data) setDeal(d.data as Deal);
    setLoaded(true);
  }, [runId]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval>;
    let nudge: ReturnType<typeof setInterval>;
    let channel: ReturnType<typeof supabaseBrowser.prototype.channel> | undefined;

    (async () => {
      try {
        const token = await ensureSession();
        if (!alive) return;
        await load();
        const sb = supabaseBrowser();
        channel = sb
          .channel(`run-${runId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "run_steps", filter: `run_id=eq.${runId}` }, () => alive && load())
          .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `run_id=eq.${runId}` }, () => alive && load())
          .on("postgres_changes", { event: "*", schema: "public", table: "receipts", filter: `run_id=eq.${runId}` }, () => alive && load())
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${runId}` }, () => alive && load())
          .subscribe();
        // Always keep polling: a finished run can still get a buyer reply to an objection.
        timer = setInterval(() => {
          load().catch(() => {});
        }, 3000);
        // Nudge the server to finish verification, stop a stuck run, or pick up the vendor's reply. Safe to repeat.
        nudge = setInterval(() => {
          const s = status.current;
          const waitingOnMail = ["awaiting_vendor", "negotiating", "vendor_reviewed"].includes(s);
          if (!waitingOnMail && TERMINAL.includes(s)) return;
          if (!waitingOnMail && ["reply_ready", "deal_done"].includes(s)) return;
          fetch(`/api/runs/${runId}/${waitingOnMail ? "vendor-check" : "finalize"}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
            .then(() => load())
            .catch(() => {});
        }, 5000);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong loading this run.");
      }
    })();

    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(nudge);
      if (channel) supabaseBrowser().removeChannel(channel);
    };
  }, [runId, load]);

  // Round 0 is the final email; round 9 is the buyer's read of a real vendor reply.
  const judge: Judge | null = (() => {
    const row = [...messages].reverse().find((m) => m.role === "judge" && (m.round ?? 0) === 0);
    if (!row) return null;
    try {
      return JSON.parse(row.text) as Judge;
    } catch {
      return null;
    }
  })();

  const offer: Offer | null = (() => {
    const row = [...messages].reverse().find((m) => m.role === "judge" && m.round === 9);
    if (!row) return null;
    try {
      return JSON.parse(row.text) as Offer;
    } catch {
      return null;
    }
  })();

  const sentTo = (() => {
    const row = [...steps].reverse().find((x) => x.lane === "mail" && x.kind === "sent");
    try {
      return row ? (JSON.parse(row.text) as { to: string; n: number }) : null;
    } catch {
      return null;
    }
  })();

  // The checkpoint the agents are paused on, if any.
  const gate: Gate | null = (() => {
    if (run?.status !== "awaiting_approval") return null;
    const row = [...steps].reverse().find((x) => x.lane === "gate" && x.kind === "gate");
    if (!row) return { gate: "review", title: "Paused for your review" };
    try {
      return JSON.parse(row.text) as Gate;
    } catch {
      return { gate: "review", title: row.text.slice(0, 80) };
    }
  })();

  return { run, deal, steps, messages, receipts, judge, offer, sentTo, gate, error, loaded, initialIds, reload: load };
}
