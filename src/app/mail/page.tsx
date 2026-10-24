"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { SplitText } from "@/components/motion";

type Row = { id: string; from: string; subject: string; at: string; snippet: string };
type Full = { id: string; from: string; to: string; subject: string; text: string; html: string | null; received_at: string };
type Box = "vendor" | "buyer";

const TABS: { id: Box; title: string; address: string; blurb: string }[] = [
  { id: "vendor", title: "Vendor desk", address: "vendor@vast-crane.primitive.email", blurb: "Mail the buyer agent sends to the vendor. Reply here as the vendor." },
  { id: "buyer", title: "Buyer inbox", address: "buyer@vast-crane.primitive.email", blurb: "Sign-in links and the winning email for the buyer account." },
];

const URL_RE = /(https?:\/\/[^\s<>"]+)/g;

function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} className="break-all text-buyer underline decoration-dotted underline-offset-2">{part}</a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function Mail() {
  const [pass, setPass] = useState("");
  const [typed, setTyped] = useState("");
  const [authed, setAuthed] = useState(false);
  const [box, setBox] = useState<Box>("vendor");
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<Full | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const r = await fetch(path, { ...init, headers: { ...(init?.headers ?? {}), "x-desk-passcode": pass, "Content-Type": "application/json" } });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        setAuthed(false);
        throw new Error("Wrong passcode.");
      }
      if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
      return j;
    },
    [pass],
  );

  // Remember the passcode for this tab only.
  useEffect(() => {
    queueMicrotask(() => {
      const saved = sessionStorage.getItem("desk-pass");
      if (saved) {
        setPass(saved);
        setTyped(saved);
      }
    });
  }, []);

  useEffect(() => {
    if (!pass) return;
    let alive = true;
    const load = () =>
      call(`/api/desk/messages?box=${box}`)
        .then((j) => {
          if (!alive) return;
          setAuthed(true);
          setRows(j.messages);
          setError(null);
        })
        .catch((e) => alive && setError(e.message));
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pass, box, call]);

  async function openMsg(id: string) {
    setNote(null);
    try {
      setOpen(await call(`/api/desk/message?id=${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that message.");
    }
  }

  async function sendReply() {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    try {
      await call("/api/desk/reply", { method: "POST", body: JSON.stringify({ id: open.id, body: reply }) });
      setReply("");
      setNote("Sent. The app will pick it up within a few seconds.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The reply did not send.");
    } finally {
      setBusy(false);
    }
  }

  const tab = TABS.find((t) => t.id === box)!;
  const signIn = open?.text.match(/https?:\/\/[^\s]+\/auth\/callback\?[^\s]+/)?.[0];

  if (!authed) {
    return (
      <div className="flex justify-center px-5 pb-24 pt-16 sm:px-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sessionStorage.setItem("desk-pass", typed);
            setPass(typed);
          }}
          className="flex w-full max-w-[460px] flex-col gap-4 rounded-3xl border border-line bg-panel/80 p-8 backdrop-blur-md"
        >
          <span className="mono text-xs uppercase tracking-[0.12em] text-vendor">Mail desk</span>
          <h1 className="disp text-3xl font-bold leading-tight"><SplitText text="Read and answer the demo mailboxes." /></h1>
          <p className="text-muted">Enter the demo passcode to open the vendor and buyer inboxes.</p>
          <input type="password" aria-label="Passcode" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Passcode" className="rounded-xl border border-[#2b3a4f] bg-ink px-4 py-3.5 outline-none transition focus:border-buyer" />
          {error && pass && <div role="alert" className="text-sm text-[#ff8b82]">{error}</div>}
          <button disabled={!typed} className="shine min-h-12 rounded-2xl bg-buyer px-6 py-3 font-semibold text-[#06231d] disabled:opacity-50">Open the mail desk</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-5 pb-24 pt-10 sm:px-8">
      <div className="flex w-full max-w-[1160px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="mono text-xs uppercase tracking-[0.12em] text-vendor">Mail desk</span>
          <h1 className="disp text-[clamp(2rem,5vw,2.8rem)] font-bold leading-[1.05]">{tab.title}</h1>
          <p className="text-muted"><span className="mono text-fg">{tab.address}</span> · {tab.blurb}</p>
        </div>

        <div className="flex gap-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setBox(t.id); setOpen(null); setRows([]); setNote(null); }} className="relative rounded-xl px-5 py-2.5 font-semibold text-muted transition hover:text-fg">
              {box === t.id && <motion.span layoutId="mail-tab" className="absolute inset-0 -z-10 rounded-xl bg-panel2" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
              <span className={box === t.id ? "text-fg" : ""}>{t.title}</span>
            </button>
          ))}
        </div>

        {error && <div role="alert" className="rounded-xl border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-4 py-3 text-sm text-[#ffb3ad]">{error}</div>}

        <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
          <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-panel/80 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="disp text-lg font-bold">Inbox</span>
              <span className="mono flex items-center gap-2 text-[11px] text-dim"><motion.span className="block size-2 rounded-full bg-buyer" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />live</span>
            </div>
            {rows.length === 0 && <div className="px-5 py-8 text-sm text-dim">Nothing here yet. New mail appears on its own.</div>}
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <motion.button key={r.id} layout initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} onClick={() => openMsg(r.id)} className={`flex flex-col gap-1 border-b border-line px-5 py-3.5 text-left transition hover:bg-panel2 ${open?.id === r.id ? "bg-panel2" : ""}`}>
                  <span className="flex items-baseline justify-between gap-2"><span className="mono truncate text-xs text-buyer">{r.from}</span><span className="mono flex-none text-[10px] text-dim">{when(r.at)}</span></span>
                  <span className="truncate font-semibold">{r.subject || "(no subject)"}</span>
                  <span className="line-clamp-2 text-sm text-muted">{r.snippet}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          <div className="min-w-0 rounded-3xl border border-line bg-panel/80 p-6 backdrop-blur-md">
            {!open ? (
              <div className="py-16 text-center text-dim">Pick a message to read it.</div>
            ) : (
              <motion.div key={open.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                <div>
                  <div className="disp text-xl font-bold leading-snug">{open.subject}</div>
                  <div className="mono mt-1 text-xs text-dim">from {open.from} · {when(open.received_at)}</div>
                </div>
                {signIn && (
                  <a href={signIn} className="shine inline-flex min-h-12 w-fit items-center rounded-2xl bg-buyer px-6 py-3 font-semibold text-[#06231d]">Open the sign-in link</a>
                )}
                {open.html ? (
                  <iframe title="Email" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={`<base target="_blank">${open.html}`} className="h-[600px] w-full rounded-2xl bg-white" />
                ) : (
                  <div className="mono whitespace-pre-wrap rounded-2xl border border-[#2b3a4f] bg-ink p-5 text-[14px] leading-[1.7] text-[#d3dce8]"><Linkified text={open.text} /></div>
                )}
                {box === "vendor" && (
                  <div className="flex flex-col gap-3 border-t border-line pt-4">
                    <label htmlFor="reply" className="disp text-lg font-bold">Reply as the vendor</label>
                    <textarea id="reply" rows={6} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={6000} placeholder={"State an annual price as a plain number, for example:\nWe can offer $8 per member per month on annual billing, which comes to $1,440 per year for 15 members."} className="mono resize-y rounded-xl border border-[#2b3a4f] bg-ink p-4 text-[14.5px] leading-[1.7] outline-none transition placeholder:text-dim focus:border-vendor" />
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={sendReply} disabled={busy || reply.trim().length < 5} className="shine min-h-12 rounded-xl bg-vendor px-6 py-3 font-semibold text-[#2a1308] disabled:opacity-50">{busy ? "Sending..." : "Send reply"}</button>
                      {note && <span className="text-sm text-buyer">{note}</span>}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
