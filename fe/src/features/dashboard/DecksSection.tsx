import type { DeckSummary } from "@voca/contract";
import type { Loadable } from "./useLoadable";
import styles from "./dashboard.module.css";

const SHOWN = 6;

export function DecksSection({ state }: { state: Loadable<readonly DeckSummary[]> }) {
  if (state.kind === "loading") return <p className={styles.muted}>Loading decks…</p>;
  if (state.kind === "failed") return <p className={styles.muted}>Couldn't load your decks.</p>;

  const shown = [...state.value].sort((a, b) => b.dueCount - a.dueCount).slice(0, SHOWN);

  return (
    <section className={styles.card} aria-label="My decks">
      <div className={styles.cardHeader}>
        <h2 className={styles.sectionTitle}>My decks</h2>
        <a className={styles.link} href="/app/decks">
          All decks →
        </a>
      </div>

      {shown.length === 0 && (
        <p className={styles.muted}>
          No decks yet. <a className={styles.link} href="/app/decks">Go to decks →</a>
        </p>
      )}

      <ul className={styles.deckGrid}>
        {shown.map((deck) => (
          <li key={deck.slug}>
            <article className={styles.deckCard}>
              <a className={styles.rowTitle} href={`/app/decks/${deck.slug}`} dir="auto">
                {deck.title}
              </a>
              <span className={styles.muted}>
                {deck.termLang} → {deck.meaningLang}
              </span>
              <span className={styles.muted}>
                {deck.wordCount} words · {deck.dueCount} due
              </span>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
