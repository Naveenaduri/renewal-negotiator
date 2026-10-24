"use client";

import { useState } from "react";

import styles from "@/app/page.module.css";
import type { PricePoint, RenewalReport } from "@/lib/report-types";

const STATUS_LABEL: Record<PricePoint["status"], string> = {
  verified: "Verified on page",
  captured: "Screenshot (check)",
  not_captured: "No screenshot",
  unsourced: "No source",
};

export function ResearchApp() {
  const [report, setReport] = useState<RenewalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendor: form.get("vendor"),
          domain: form.get("domain"),
          currentDeal: form.get("currentDeal"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`${json.error ?? res.statusText}${json.requestId ? ` (request ${json.requestId})` : ""}`);
      setReport(json as RenewalReport);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={onSubmit}>
        <label>
          Vendor
          <input name="vendor" required maxLength={100} placeholder="e.g. Notion" />
        </label>
        <label>
          Website (optional)
          <input name="domain" placeholder="notion.com" />
        </label>
        <label>
          Current deal (optional)
          <input name="currentDeal" placeholder="Business plan, 40 seats, $15/seat/mo annual" />
        </label>
        <button className={styles.button} disabled={loading}>
          {loading ? "Researching… (~1 min)" : "Research"}
        </button>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      {report && (
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2>
            {report.vendor.name}{" "}
            {report.vendor.pricingPageUrl && (
              <a className={styles.small} href={report.vendor.pricingPageUrl} target="_blank" rel="noreferrer">
                pricing page ↗
              </a>
            )}
          </h2>
          {report.warnings.map((w) => (
            <div key={w} className={styles.warn}>{w}</div>
          ))}

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Plan</th>
                <th>Price</th>
                <th>Source</th>
                <th>Screenshot</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.pricePoints.map((p) => {
                const ev = p.evidenceId ? report.evidence[p.evidenceId] : undefined;
                return (
                  <tr key={p.id}>
                    <td>{p.product}{p.kind === "alternative" && <div className={styles.small}>alternative</div>}</td>
                    <td>{p.plan}</td>
                    <td>
                      {p.price ?? "—"}
                      {p.billingPeriod && <div className={styles.small}>{p.billingPeriod}</div>}
                    </td>
                    <td>
                      {p.sourceUrl ? (
                        <a className={styles.small} href={p.sourceUrl} target="_blank" rel="noreferrer">{p.sourceUrl}</a>
                      ) : "—"}
                      {ev && <div className={styles.small}>captured {new Date(ev.capturedAt).toLocaleString()}</div>}
                    </td>
                    <td>
                      {ev?.screenshot ? (
                        <a href={ev.screenshot} target="_blank" rel="noreferrer" title="Open full screenshot">
                          {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL from Context.dev */}
                          <img className={styles.thumb} src={ev.screenshot} alt={`Screenshot of ${ev.url}`} />
                        </a>
                      ) : (
                        <span className={styles.small}>{ev?.error ?? "—"}</span>
                      )}
                    </td>
                    <td><span className={`${styles.badge} ${styles[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {report.negotiationLevers.length > 0 && (
            <div>
              <h3>Negotiation levers</h3>
              <ul>{report.negotiationLevers.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          )}
          <p className={styles.small}>Credits used: {report.creditsConsumed} · generated {new Date(report.generatedAt).toLocaleString()}</p>
        </section>
      )}
    </>
  );
}
