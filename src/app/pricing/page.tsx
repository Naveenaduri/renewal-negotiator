import type { Metadata } from "next";

import styles from "./pricing.module.css";

export const metadata: Metadata = { title: "Pricing · Renewal Negotiator" };

export default function Pricing() {
  return (
    <section className={styles.wrap}>
      <h1>Pricing</h1>
      <div className={styles.plans}>
        <div className="card">
          <h2>Free</h2>
          <p className="muted">Rehearse renewal negotiations with a receipt for every price claim.</p>
        </div>
        <div className="card">
          <h2>Pro</h2>
          <p className="muted">For teams with many renewals.</p>
          <button type="button" className="button" disabled aria-disabled="true">
            Pro: coming soon
          </button>
        </div>
      </div>
    </section>
  );
}
