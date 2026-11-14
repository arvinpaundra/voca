import { session } from "../../lib/appSession";
import { Container } from "../../components/Container";
import { ActivitySection } from "./ActivitySection";
import { DecksSection } from "./DecksSection";
import { ProgressSection } from "./ProgressSection";
import { StreakSection } from "./StreakSection";
import { TodaySection } from "./TodaySection";
import { useLoadable } from "./useLoadable";
import styles from "./dashboard.module.css";

export function DashboardPage() {
  // Every section loads its own data: a failed call shows its own message and the rest of the page still renders.
  const learner = useLoadable(() => session.call((client) => client.me.get()), []);
  const stats = useLoadable(() => session.call((client) => client.insight.learnerStats()), []);
  const notifications = useLoadable(() => session.call((client) => client.insight.notifications()), []);
  const decks = useLoadable(() => session.call((client) => client.library.listDecks()), []);

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          {learner.kind === "loading" && <p className={styles.muted}>Loading…</p>}
          {learner.kind === "failed" && <p className={styles.muted}>Couldn't load your dashboard.</p>}

          {learner.kind === "loaded" && (
            <>
              <h1 className={styles.greeting}>Hello, {learner.value.name.trim().split(/\s+/)[0]}</h1>

              <div className={styles.pair}>
                <StreakSection state={stats} />
                <TodaySection state={notifications} />
              </div>

              <div className={styles.pair}>
                <ActivitySection learner={learner.value} />
                <ProgressSection state={stats} />
              </div>

              <DecksSection state={decks} />
            </>
          )}
        </div>
      </Container>
    </div>
  );
}
