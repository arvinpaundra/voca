import type { Activity } from "@voca/contract";
import styles from "./heatmap.module.css";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

type HeatmapProps = {
  month: string; // "YYYY-MM"
  days: Activity["days"]; // only days with reviews (sparse)
  today: string; // "YYYY-MM-DD", the study date: days after it are drawn as future
};

// Dates are formatted in UTC so that a calendar day never shifts with the browser's timezone.
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function Heatmap({ month, days, today }: HeatmapProps) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leading = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(); // Sunday = 0

  const byDate = new Map(days.map((d) => [d.date, d.reviews]));
  const active = days.map((d) => d.reviews).sort((a, b) => a - b);
  const quartile = (f: number) => active[Math.floor(f * (active.length - 1))] ?? 0;
  const q1 = quartile(0.25);
  const q2 = quartile(0.5);
  const q3 = quartile(0.75);
  const level = (n: number) => (n === 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4);

  const total = days.reduce((sum, d) => sum + d.reviews, 0);
  const monthName = monthFormat.format(new Date(Date.UTC(year, monthIndex, 1)));

  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const dayLabel = dayFormat.format(new Date(Date.UTC(year, monthIndex, day)));
    const isFuture = date > today;
    const reviews = byDate.get(date) ?? 0;
    const countLabel = reviews === 0 ? "No reviews" : `${reviews} review${reviews === 1 ? "" : "s"}`;
    return (
      <span
        key={day}
        className={isFuture ? `${styles.cell} ${styles.future}` : styles.cell}
        data-l={isFuture ? undefined : level(reviews)}
        title={isFuture ? dayLabel : `${countLabel} · ${dayLabel}`}
      >
        {day}
      </span>
    );
  });

  return (
    <div className={styles.activity}>
      <div className={styles.header}>
        <strong className={styles.month}>{monthName}</strong>
        <span className="label">{total} reviews</span>
      </div>
      <div
        className={styles.heat}
        role="img"
        aria-label={`Study activity for ${monthName}: ${total} reviews`}
      >
        {WEEKDAYS.map((d, i) => (
          <span key={`w${i}`} className={styles.wd}>
            {d}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`p${i}`} className={styles.pad} aria-hidden="true" />
        ))}
        {cells}
      </div>
      <div className={styles.legend} aria-hidden="true">
        <span>Less</span>
        <span className={styles.legendCell} />
        <span className={styles.legendCell} data-l="1" />
        <span className={styles.legendCell} data-l="2" />
        <span className={styles.legendCell} data-l="3" />
        <span className={styles.legendCell} data-l="4" />
        <span>More</span>
      </div>
    </div>
  );
}
