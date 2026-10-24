"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Who = { email: string } | null; // null: nobody, or a guest session (samples work without signing in)

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [who, setWho] = useState<Who>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    const read = (u?: { email?: string | null; is_anonymous?: boolean } | null) =>
      setWho(u && !u.is_anonymous && u.email ? { email: u.email } : null);
    sb.auth.getSession().then(({ data }) => read(data.session?.user));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => read(s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    setLeaving(true);
    await supabaseBrowser().auth.signOut();
    setLeaving(false);
    setWho(null);
    router.push("/");
    router.refresh();
  }

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className="sticky top-0 z-30 flex justify-center px-4 pt-4 sm:px-8"
    >
      <nav className="flex w-full max-w-[1160px] items-center justify-between gap-4 rounded-2xl border border-line/80 bg-ink/60 px-4 py-2.5 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2.5">
          <motion.span
            whileHover={{ rotate: 180 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            className="block size-7 rounded-lg"
            style={{ background: "linear-gradient(135deg,#3ee0c1 0 50%,#ff9966 50% 100%)" }}
          />
          <span className="disp text-lg font-bold">Renewal Negotiator</span>
        </Link>
        <div className="flex items-center gap-1 text-[15px] text-muted">
          <Link href="/new" className="relative rounded-lg px-3 py-2 transition-colors hover:text-fg">
            {path.startsWith("/new") && (
              <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-lg bg-panel2" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
            )}
            <span className={path.startsWith("/new") ? "text-fg" : ""}>New rehearsal</span>
          </Link>
          <Link href="/pricing" className={`rounded-lg px-3 py-2 transition-colors hover:text-fg ${path.startsWith("/pricing") ? "text-fg" : ""}`}>
            Pricing
          </Link>
          <AnimatePresence mode="wait" initial={false}>
            {who ? (
              <motion.div key="in" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="ml-2 flex items-center gap-2">
                <span className="mono hidden max-w-[200px] truncate rounded-full border border-line px-3 py-2 text-xs text-fg sm:block" title={who.email}>{who.email}</span>
                <button onClick={signOut} disabled={leaving} className="rounded-full border border-line px-4 py-2 text-fg transition hover:border-vendor hover:text-vendor disabled:opacity-60">
                  {leaving ? "Signing out..." : "Sign out"}
                </button>
              </motion.div>
            ) : (
              <motion.div key="out" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="ml-2">
                <Link href="/signin" className="rounded-full border border-line px-4 py-2 text-fg transition hover:border-buyer hover:text-buyer">Sign in</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </motion.header>
  );
}
