import { ResearchApp } from "@/components/research-app";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <header>
        <h1>Renewal Negotiator</h1>
        <p className={styles.muted}>
          Research a vendor&apos;s public pricing and alternatives. Every price links to its source page with a screenshot.
        </p>
      </header>
      <ResearchApp />
    </main>
  );
}
