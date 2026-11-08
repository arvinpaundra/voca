import styles from "./heatmap.module.css";

export type ActivityDay = { day: number; reviews: number };

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

type HeatmapProps = {
  year: number;
  month: number; // 0-based
  days: ReadonlyArray<ActivityDay>; // only days with reviews (sparse)
  today?: Date; // marks days after `today` as future (outlined)
};

export function Heatmap({ year, month, days, today = new Date() }: HeatmapProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay(); // Sunday = 0
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const byDay = new Map(days.map((d) => [d.day, d.reviews]));
  const active = days.map((d) => d.reviews).sort((a, b) => a - b);
  const quartile = (f: number) => active[Math.floor(f * (active.length - 1))] ?? 0;
  const q1 = quartile(0.25);
  const q2 = quartile(0.5);
  const q3 = quartile(0.75);
  const level = (n: number) => (n === 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4);

  const total = days.reduce((sum, d) => sum + d.reviews, 0);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );
  const dayFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(year, month, day);
    const isFuture = date.getTime() > todayMid.getTime();
    const reviews = byDay.get(day) ?? 0;
    const countLabel = reviews === 0 ? "No reviews" : `${reviews} review${reviews === 1 ? "" : "s"}`;
    return (
      <span
        key={day}
        className={isFuture ? `${styles.cell} ${styles.future}` : styles.cell}
        data-l={isFuture ? undefined : level(reviews)}
        title={isFuture ? dayFmt.format(date) : `${countLabel} · ${dayFmt.format(date)}`}
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
