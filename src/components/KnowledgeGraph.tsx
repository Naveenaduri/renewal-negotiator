"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Deal, Gate, Judge, Message, ReceiptRow, RunRow, Step } from "@/hooks/useRun";

type State = "done" | "active" | "pending" | "flagged";
type Kind = "email" | "source" | "round" | "you" | "claim" | "final";
type Node = {
  id: string;
  kind: Kind;
  col: number;
  label: string;
  name: string;
  sub: string;
  state: State;
  detail: { title: string; text: string; href?: string; img?: string | null };
  y: number;
  x: number;
};
type Edge = { id: string; from: string; to: string; pending?: boolean };

const COLS = [90, 330, 600, 860, 1090];
const HEADS = ["EMAIL", "SOURCES", "REHEARSAL", "CLAIMS", "FINAL EMAIL"];
const COLOR: Record<State, string> = { done: "#3ee0c1", active: "#ff9966", pending: "#5b6b80", flagged: "#ff6b6b" };
const FILL: Record<State, string> = { done: "#0f2a27", active: "#2a1a10", pending: "#131a24", flagged: "#2a1213" };

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const hostOf = (u: string) => {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
};
const cites = (t: string) => [...t.matchAll(/\[R(\d+)\]/g)].map((m) => `src${m[1]}`);
const clean = (t: string) => t.replace(/\s*\[R\d+\]/g, "").trim();

function spread(n: number) {
  if (n <= 1) return [215];
  const top = 95;
  const bottom = 335;
  return Array.from({ length: n }, (_, i) => top + ((bottom - top) * i) / (n - 1));
}

export default function KnowledgeGraph(props: {
  run: RunRow | null;
  deal: Deal | null;
  steps: Step[];
  messages: Message[];
  receipts: ReceiptRow[];
  judge: Judge | null;
  gate: Gate | null;
}) {
  const { run, deal, steps, messages, receipts, judge, gate } = props;
  const [picked, setPicked] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const status = run?.status ?? "queued";
    const complete = status === "complete";
    const has = (lane: string, kind: string) => steps.some((s) => s.lane === lane && s.kind === kind);
    const verifierDone = false; // the graph shows the story, not a validation result
    const gateName = (gate?.gate ?? "").toLowerCase();
    const reviewing = status === "awaiting_approval";
    const running = !complete && status !== "failed" && !reviewing;

    const ns: Node[] = [];
    const es: Edge[] = [];

    // Email
    const extractorDone = has("extractor", "done");
    ns.push({
      id: "email", kind: "email", col: 0, x: COLS[0], y: 215, label: "@",
      name: deal?.vendor ?? "Renewal email",
      sub: deal?.price ? `$${Number(deal.price).toLocaleString()} per year` : "reading...",
      state: reviewing && gateName.includes("extraction") ? "active" : extractorDone ? "done" : "active",
      detail: { title: deal?.vendor ? `${deal.vendor} ${deal.product ?? ""}`.trim() : "The renewal email", text: deal?.renewal_date ? `Renews ${deal.renewal_date}.` : "The extractor is reading it." },
    });

    // Sources
    const sy = spread(receipts.length);
    const researcherDone = has("researcher", "done");
    receipts.forEach((r, i) => {
      const state: State = verifierDone ? (r.verified ? "done" : "flagged") : reviewing && gateName.includes("research") ? "active" : "done";
      ns.push({
        id: `src${i + 1}`, kind: "source", col: 1, x: COLS[1], y: sy[i], label: `R${i + 1}`,
        name: hostOf(r.source_url), sub: cut(r.claim.replace(/^.*?:\s*/, ""), 22), state,
        detail: { title: `R${i + 1} · ${hostOf(r.source_url)}`, text: r.claim + (verifierDone ? (r.verified ? " Verified against the live page." : " Could not be verified.") : ""), href: r.source_url, img: r.screenshot_url },
      });
      es.push({ id: `e-src${i + 1}`, from: "email", to: `src${i + 1}` });
    });
    if (!researcherDone && extractorDone && receipts.length === 0) {
      ns.push({ id: "src0", kind: "source", col: 1, x: COLS[1], y: 215, label: "…", name: "researching", sub: "finding sources", state: "active", detail: { title: "Researching", text: "The researcher is looking for public pricing pages." } });
      es.push({ id: "e-src0", from: "email", to: "src0", pending: true });
    }

    // Rounds (buyer + vendor pairs), plus the user's objections
    const roundNums = [...new Set(messages.filter((m) => m.role === "buyer" || m.role === "vendor_sim").map((m) => Math.min(m.round ?? 1, 3)))].filter((r) => r >= 1 && r <= 3).sort();
    const objections = messages.filter((m) => m.role === "user_vendor");
    const rehearsalDone = has("judge", "start") || !!judge;
    const lastRound = roundNums[roundNums.length - 1] ?? 0;
    const roundRows: { id: string; r: number }[] = roundNums.map((r) => ({ id: `rd${r}`, r }));
    const pendingRound = !rehearsalDone && lastRound < 3 && receipts.length > 0 ? lastRound + 1 : 0;
    const rowCount = roundRows.length + (pendingRound ? 1 : 0) + objections.length;
    const ry = spread(rowCount);
    let k = 0;
    for (const { id, r } of roundRows) {
      const ms = messages.filter((m) => Math.min(m.round ?? 1, 3) === r && (m.role === "buyer" || m.role === "vendor_sim"));
      const buyer = ms.find((m) => m.role === "buyer");
      const vendor = ms.find((m) => m.role === "vendor_sim");
      const state: State = reviewing && gateName === `round ${r}` ? "active" : vendor ? "done" : "active";
      ns.push({
        id, kind: "round", col: 2, x: COLS[2], y: ry[k++], label: `RD${r}`, name: `Round ${r}`, sub: cut(clean(buyer?.text ?? "").replace(/^(Hi|Hello|Dear)[^,]*,\s*/i, ""), 22),
        state,
        detail: { title: `Round ${r}`, text: `Buyer: ${clean(buyer?.text ?? "...")}\n\nSimulated vendor rep: ${clean(vendor?.text ?? "...")}` },
      });
      const cited = new Set(ms.flatMap((m) => cites(m.text)));
      cited.forEach((c) => es.push({ id: `e-${c}-${id}`, from: c, to: id }));
      if (cited.size === 0 && receipts.length) es.push({ id: `e-x-${id}`, from: "email", to: id, pending: true });
    }
    if (pendingRound) {
      ns.push({ id: `rd${pendingRound}`, kind: "round", col: 2, x: COLS[2], y: ry[k++], label: `RD${pendingRound}`, name: `Round ${pendingRound}`, sub: "", state: running || reviewing ? "pending" : "pending", detail: { title: `Round ${pendingRound}`, text: "Not started yet." } });
      if (receipts.length) es.push({ id: `e-pend-${pendingRound}`, from: `src${receipts.length}`, to: `rd${pendingRound}`, pending: true });
    }
    objections.forEach((o, i) => {
      const reply = messages.find((m) => m.role === "buyer" && (m.round ?? 0) >= 4 && m.id > o.id);
      ns.push({
        id: `you${i}`, kind: "you", col: 2, x: COLS[2], y: ry[k++], label: "YOU", name: o.round === 5 ? "Vendor reply" : "Your objection", sub: cut(o.text, 22), state: reply ? "done" : "active",
        detail: { title: o.round === 5 ? "The vendor replied by email" : "You played the vendor", text: `You: ${o.text}\n\nBuyer: ${reply ? clean(reply.text) : "Preparing a reply with evidence..."}` },
      });
      cites(reply?.text ?? "").forEach((c) => es.push({ id: `e-${c}-you${i}`, from: c, to: `you${i}` }));
    });

    // Claims
    const claims = judge?.claims ?? [];
    const cy = spread(Math.max(claims.length, rehearsalDone ? 1 : roundRows.length ? 1 : 0));
    const byLabel = new Map(receipts.map((r, i) => [`R${i + 1}`, r]));
    claims.forEach((c, i) => {
      const r = byLabel.get(c.receipt);
      const amount = c.text.match(/\$\s?\d[\d,.]*/)?.[0] ?? "claim";
      const state: State = "done";
      ns.push({
        id: `clm${i}`, kind: "claim", col: 3, x: COLS[3], y: cy[i], label: amount, name: cut(c.text.replace(/^.*?:\s*/, ""), 20), sub: c.receipt,
        state,
        detail: { title: `Claim ${i + 1}, backed by ${c.receipt}`, text: c.text + (verifierDone ? (r?.verified ? " Verified in code against the source page." : " Flagged: the price was not found on the source page.") : " Waiting for verification."), href: r?.source_url },
      });
      const num = c.receipt.replace("R", "");
      const src = `src${num}`;
      const fromRound = [...roundRows].reverse().find((rr) => messages.some((m) => Math.min(m.round ?? 1, 3) === rr.r && cites(m.text).includes(src)))?.id ?? roundRows[roundRows.length - 1]?.id;
      if (fromRound) es.push({ id: `e-clm${i}-in`, from: fromRound, to: `clm${i}` });
      es.push({ id: `e-clm${i}-out`, from: `clm${i}`, to: "final" });
    });
    if (claims.length === 0 && roundRows.length) {
      ns.push({ id: "clm?", kind: "claim", col: 3, x: COLS[3], y: cy[0], label: "?", name: "claims", sub: "after the rounds", state: "pending", detail: { title: "Claims", text: "Price claims appear once the judge writes the final email." } });
      es.push({ id: "e-clm?-in", from: roundRows[roundRows.length - 1].id, to: "clm?", pending: true });
      es.push({ id: "e-clm?-out", from: "clm?", to: "final", pending: true });
    }

    // Final email
    const good = claims.filter((c) => byLabel.get(c.receipt)?.verified).length;
    ns.push({
      id: "final", kind: "final", col: 4, x: COLS[4], y: 215, label: "✉",
      name: "final email", sub: judge?.email ? "ready to send" : "after the rehearsal",
      state: judge?.email ? "done" : "pending",
      detail: { title: "Final email", text: judge?.email ?? "The judge writes this after the rehearsal." },
    });
    return { nodes: ns, edges: es };
  }, [run, deal, steps, messages, receipts, judge, gate]);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const selected = (picked && byId.get(picked)) || nodes.find((n) => n.state === "active") || null;

  return (
    <div className="flex flex-col gap-3 rounded-[26px] border border-line bg-panel/80 p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="disp text-[22px] font-bold">How the run is thinking</div>
          <div className="text-sm text-muted">Draws itself as the agents work. Click any dot to see what is behind it.</div>
        </div>
        <div className="mono flex flex-wrap gap-4 text-[11px] text-muted">
          {([["done", "done"], ["active", "you are here"], ["pending", "not yet"], ["flagged", "flagged"]] as const).map(([s, l]) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="block size-2.5 rounded-full border-2" style={{ borderColor: COLOR[s], borderStyle: s === "pending" ? "dashed" : "solid" }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <svg viewBox="0 0 1200 430" width="100%" role="img" aria-label="Knowledge graph of the run: email, sources, rehearsal rounds, claims and final email">
            {HEADS.map((h, i) => (
              <text key={h} x={COLS[i]} y={22} textAnchor="middle" fontSize="10" letterSpacing="1.4" fill="#7d8ca1" fontFamily="var(--font-mono), monospace">{h}</text>
            ))}
            <AnimatePresence>
              {edges.map((e) => {
                const a = byId.get(e.from);
                const b = byId.get(e.to);
                if (!a || !b) return null;
                const x1 = a.x + (a.kind === "claim" || a.kind === "final" ? 26 : 28);
                const x2 = b.x - (b.kind === "claim" || b.kind === "final" ? 26 : 28);
                const mx = (x1 + x2) / 2;
                const live = b.state === "active" && a.state !== "pending";
                return (
                  <motion.path
                    key={e.id}
                    d={`M${x1} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${x2} ${b.y}`}
                    fill="none"
                    strokeWidth={2}
                    stroke={e.pending ? "#5b6b80" : live ? "#ff9966" : "#3ee0c1"}
                    strokeOpacity={e.pending ? 0.9 : live ? 1 : 0.55}
                    strokeDasharray={e.pending ? "5 7" : live ? "6 6" : undefined}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1, ...(live ? { strokeDashoffset: [0, -24] } : {}) }}
                    transition={{ pathLength: { duration: 1, ease: "easeOut" }, strokeDashoffset: { duration: 1, repeat: Infinity, ease: "linear" } }}
                  />
                );
              })}
            </AnimatePresence>
            <AnimatePresence>
              {nodes.map((n) => {
                const c = COLOR[n.state];
                const isBox = n.kind === "claim" || n.kind === "final";
                const sel = selected?.id === n.id;
                return (
                  <motion.g
                    key={n.id}
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    style={{ transformBox: "fill-box", transformOrigin: "center", cursor: "pointer" }}
                    onClick={() => setPicked(n.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.name}: ${n.state}`}
                    onKeyDown={(ev) => ev.key === "Enter" && setPicked(n.id)}
                  >
                    {n.state === "active" && (
                      <motion.circle cx={n.x} cy={n.y} r={isBox ? 32 : 28} fill="none" stroke="#ff9966" strokeWidth={2} animate={{ scale: [1, 2], opacity: [0.7, 0] }} transition={{ duration: 1.8, repeat: Infinity }} style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                    )}
                    {isBox ? (
                      <rect x={n.x - 28} y={n.y - (n.kind === "final" ? 32 : 18)} width={56} height={n.kind === "final" ? 64 : 36} rx={12} fill={FILL[n.state]} stroke={sel ? "#e8edf4" : c} strokeWidth={sel ? 3 : 2} strokeDasharray={n.state === "pending" ? "4 5" : undefined} />
                    ) : (
                      <circle cx={n.x} cy={n.y} r={n.kind === "email" ? 30 : 26} fill={FILL[n.state]} stroke={sel ? "#e8edf4" : c} strokeWidth={sel ? 3 : 2} strokeDasharray={n.state === "pending" ? "4 5" : undefined} />
                    )}
                    <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={n.kind === "final" ? 18 : 11} fill={c} fontFamily="var(--font-mono), monospace">{cut(n.label, 6)}</text>
                    <text x={n.x} y={n.y + (n.kind === "final" ? 52 : 46)} textAnchor="middle" fontSize="11" fill={n.state === "pending" ? "#7d8ca1" : "#e8edf4"} fontFamily="var(--font-mono), monospace">{cut(n.name, 18)}</text>
                    {n.sub && <text x={n.x} y={n.y + (n.kind === "final" ? 67 : 61)} textAnchor="middle" fontSize="10" fill="#7d8ca1" fontFamily="var(--font-mono), monospace">{cut(n.sub, 22)}</text>}
                  </motion.g>
                );
              })}
            </AnimatePresence>
          </svg>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div key={selected.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-ink/60 p-4">
            <div className="min-w-0 flex-1">
              <div className="mono text-[11px] tracking-[0.1em]" style={{ color: COLOR[selected.state] }}>{selected.state === "active" ? "IN FOCUS" : selected.state.toUpperCase()} · {selected.detail.title}</div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{selected.detail.text}</p>
              {selected.detail.href && (
                <a href={selected.detail.href} target="_blank" rel="noopener noreferrer" className="mono mt-2 inline-block text-xs text-buyer underline decoration-dotted underline-offset-2">Open source page</a>
              )}
            </div>
            {selected.detail.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.detail.img} alt="Screenshot of the source" className="h-24 w-44 rounded-lg border border-line object-cover object-top" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
