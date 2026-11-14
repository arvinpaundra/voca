import type { Notifications } from "@voca/contract";
import { Button } from "../../components/Button";
import type { Loadable } from "./useLoadable";
import styles from "./dashboard.module.css";

export function TodaySection({ state }: { state: Loadable<Notifications> }) {
  if (state.kind === "loading") return <p className={styles.muted}>Loading today…</p>;
  if (state.kind === "failed") return <p className={styles.muted}>Couldn't load today.</p>;

  const { decks, hardDue, newAvailable } = state.value;
  const [firstDeck] = decks;
  const totalDue = decks.reduce((sum, deck) => sum + deck.due, 0);
  const totalOverdue = decks.reduce((sum, deck) => sum + deck.overdue, 0);

  return (
    <section className={styles.card} aria-label="Today">
      <h2 className={styles.sectionTitle}>Today</h2>
      <p className={styles.counts}>
        <span>{totalDue} due</span>
        <span>{totalOverdue} overdue</span>
        <span>{hardDue} hard</span>
        <span>{newAvailable} new</span>
      </p>

      {firstDeck !== undefined && (
        <Button variant="primary" href={`/app/decks/${firstDeck.deckSlug}/study`}>
          Start studying
        </Button>
      )}

      {totalDue === 0 && <p className={styles.muted}>All caught up</p>}

      <ul className={styles.list}>
        {decks.map((deck) => (
          <li key={deck.deckSlug}>
            <a className={styles.row} href={`/app/decks/${deck.deckSlug}/study`}>
              <span className={styles.rowTitle}>{deck.title}</span>
              <span className={styles.muted}>
                {deck.due} due
                {deck.overdue > 0 && ` · ${deck.overdue} overdue`}
              </span>
              <span className={styles.muted}>
                {deck.byDrill.map((drill) => `${drill.label} ${drill.due}`).join(" · ")}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
