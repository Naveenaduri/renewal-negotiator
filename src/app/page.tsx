import Link from "next/link";

import styles from "./page.module.css";

export default function Landing() {
  return (
    <section className={styles.hero}>
      <h1 className={styles.title}>Rehearse the negotiation before you send it.</h1>
      <p className={styles.pitch}>
        For small teams that auto-renew software they never review: forward a renewal, and two agents rehearse the
        negotiation with receipts.
      </p>
      <div className={styles.actions}>
        <Link href="/new" className={`button ${styles.cta}`}>
          Try a sample renewal
        </Link>
        <Link href="/login" className="button button-secondary">
          Sign in
        </Link>
      </div>
    </section>
  );
}
