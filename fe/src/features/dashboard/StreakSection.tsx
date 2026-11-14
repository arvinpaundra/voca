import type { LearnerStats } from "@voca/contract";
import { streakMessage } from "./dashboardModel";
import type { Loadable } from "./useLoadable";
import styles from "./dashboard.module.css";

export function StreakSection({ state }: { state: Loadable<LearnerStats> }) {
  if (state.kind === "loading") return <p className={styles.muted}>Loading your streak…</p>;
  if (state.kind === "failed") return <p className={styles.muted}>Couldn't load your streak.</p>;

  const { streak } = state.value;

  return (
    <section className={styles.card} aria-label="Streak">
      <p className={styles.bigNumber}>{streak.days}</p>
      <p className={styles.label}>day streak</p>
      <p className={styles.muted}>{streakMessage(streak)}</p>
    </section>
  );
}
