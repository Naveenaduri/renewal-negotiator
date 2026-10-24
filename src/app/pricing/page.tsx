import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pricing · Renewal Negotiator" };

export default function Pricing() {
  return (
    <section className="mx-auto w-full max-w-[1160px] px-5 pb-24 pt-16 sm:px-8">
      <h1 className="disp text-[clamp(2rem,4.5vw,2.8rem)] font-bold leading-tight">Pricing</h1>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-line bg-panel/80 p-6 backdrop-blur-md">
          <h2 className="disp text-2xl font-bold">Free</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Rehearse renewal negotiations with a receipt for every price claim.
          </p>
        </div>
        <div className="rounded-3xl border border-line bg-panel/80 p-6 backdrop-blur-md">
          <h2 className="disp text-2xl font-bold">Pro</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">For teams with many renewals.</p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-6 min-h-12 cursor-not-allowed rounded-2xl border border-line bg-panel2 px-6 py-3 font-semibold text-dim"
          >
            Pro: coming soon
          </button>
        </div>
      </div>
    </section>
  );
}
