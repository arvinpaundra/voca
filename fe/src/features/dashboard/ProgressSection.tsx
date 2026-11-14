import type { LearnerStats } from "@voca/contract";
import type { Loadable } from "./useLoadable";
import styles from "./dashboard.module.css";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const percent = (ratio: number | null | undefined) => (ratio === null || ratio === undefined ? "—" : `${Math.round(ratio * 100)}%`);

const weekdayOf = (date: string) => WEEKDAY_LETTERS[new Date(`${date}T00:00:00Z`).getUTCDay()];

export function ProgressSection({ state }: { state: Loadable<LearnerStats> }) {
  if (state.kind === "loading") return <p className={styles.muted}>Loading progress…</p>;
  if (state.kind === "failed") return <p className={styles.muted}>Couldn't load progress.</p>;

  const stats = state.value;
  const { maturity, trueRetention, calibration, reviewsPerDay, forecast } = stats;
  const cardCount = maturity.new + maturity.learning + maturity.mature;
  const segments = [
    { label: "New", count: maturity.new, className: styles.segmentNew },
    { label: "Learning", count: maturity.learning, className: styles.segmentLearning },
    { label: "Mature", count: maturity.mature, className: styles.segmentMature },
  ];
  const busiest = Math.max(1, ...reviewsPerDay.map((day) => day.count));

  return (
    <section className={styles.card} aria-label="Progress">
      <h2 className={styles.sectionTitle}>Progress</h2>

      <div className={styles.segmentBar} role="img" aria-label={`${cardCount} cards`}>
        {segments.map((segment) =>
          segment.count > 0 ? (
            <span
              key={segment.label}
              className={segment.className}
              style={{ flexGrow: segment.count }}
            />
          ) : null,
        )}
      </div>
      <p className={styles.counts}>
        {segments.map((segment) => (
          <span key={segment.label}>
            {segment.label} {segment.count}
          </span>
        ))}
      </p>

      <dl className={styles.pairs}>
        <div>
          <dt className={styles.muted}>True retention</dt>
          <dd>{percent(trueRetention)}</dd>
        </div>
        <div>
          <dt className={styles.muted}>Predicted vs. actual recall</dt>
          <dd>
            {calibration === null
              ? "—"
              : `${percent(calibration.predicted)} vs. ${percent(calibration.actual)}`}
          </dd>
        </div>
      </dl>

      <div>
        <p className={styles.muted}>Reviews, last 30 days</p>
        <svg className={styles.sparkline} viewBox="0 0 300 60" preserveAspectRatio="none" role="img" aria-label="Reviews per day, last 30 days">
          {reviewsPerDay.map((day, i) => {
            const barHeight = (day.count / busiest) * 56;
            return (
              <rect
                key={day.date}
                x={i * 10 + 1}
                y={60 - barHeight}
                width={8}
                height={barHeight}
                rx={1}
              >
                <title>{`${day.count} reviews · ${day.date}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>

      <div>
        <p className={styles.muted}>Next 7 days</p>
        <ul className={styles.forecast}>
          {forecast.map((day) => (
            <li key={day.date} className={styles.forecastDay}>
              <span className={styles.muted}>{weekdayOf(day.date)}</span>
              <span>{day.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
