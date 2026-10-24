"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Check } from "@/components/motion";
import { supabaseBrowser } from "@/lib/supabase";

function Callback() {
  const sp = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);
  const incomplete = !sp.get("token_hash");

  useEffect(() => {
    if (started.current) return; // the link is single use, so redeem it exactly once
    started.current = true;
    const tokenHash = sp.get("token_hash");
    const raw = sp.get("next") ?? "/new";
    const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/new";
    if (!tokenHash) return;
    supabaseBrowser()
      .auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" })
      .then(({ error: err }) => {
        if (err) setError("This sign-in link has expired or was already used. Request a new one.");
        else {
          setDone(true);
          setTimeout(() => router.replace(next), 900);
        }
      });
  }, [sp, router]);

  return (
    <div className="flex justify-center px-5 py-24">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-4 rounded-3xl border border-line bg-panel/80 p-10 text-center backdrop-blur-md">
        {error || incomplete ? (
          <>
            <div className="disp text-2xl font-bold">Sign-in did not work</div>
            <p className="text-muted">{error ?? "This sign-in link is incomplete. Request a new one."}</p>
            <Link href="/signin" className="inline-flex min-h-11 items-center rounded-xl bg-buyer px-5 py-2.5 font-semibold text-[#06231d]">Get a new link</Link>
          </>
        ) : done ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-buyer text-[#06231d]"><Check size={28} /></span>
            <div className="disp text-2xl font-bold">You are signed in</div>
          </>
        ) : (
          <>
            <motion.span className="block size-10 rounded-full border-[3px] border-vendor border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
            <div className="disp text-2xl font-bold">Signing you in</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
