import { useState } from "react";
import { DateTime } from "effect";
import type { Learner } from "@voca/contract";
import { Heatmap } from "../../components/Heatmap";
import { session } from "../../lib/appSession";
import { shiftMonth, studyDate } from "./dashboardModel";
import { useLoadable } from "./useLoadable";
import styles from "./dashboard.module.css";

export function ActivitySection({ learner }: { learner: Learner }) {
  const { timezone, dayStartHour } = learner.settings;

  // Frozen at mount: the month navigation and the "today" outline stay consistent while the page is open.
  const [today] = useState(() => studyDate(DateTime.nowUnsafe(), timezone, dayStartHour));
  const signUpMonth = studyDate(learner.createdAt, timezone, dayStartHour).slice(0, 7);
  const currentMonth = today.slice(0, 7);

  const [month, setMonth] = useState(currentMonth);
  const activity = useLoadable(
    () => session.call((client) => client.insight.activity({ query: { month } })),
    [month],
  );

  const canGoBack = month > signUpMonth;
  const canGoForward = month < currentMonth;

  return (
    <section className={styles.card} aria-label="Activity">
      <div className={styles.monthNav}>
        <button
          className={styles.navButton}
          type="button"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          ‹
        </button>
        <button
          className={styles.navButton}
          type="button"
          aria-label="Next month"
          disabled={!canGoForward}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          ›
        </button>
      </div>

      {activity.kind === "loading" && <p className={styles.muted}>Loading activity…</p>}
      {activity.kind === "failed" && <p className={styles.muted}>Couldn't load activity.</p>}
      {activity.kind === "loaded" && <Heatmap month={month} days={activity.value.days} today={today} />}
    </section>
  );
}
