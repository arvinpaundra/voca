import type { Activity } from "@voca/contract";
import { cx } from "./cx";

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

// The legend swatches, level 0 to 4: the colours console.css gives `.heat .d` and `.l1` to `.l4`.
const LEGEND = ["#efeeed", "#e6ffc7", "#d4ffa0", "#c1ff72", "#8fd43a"] as const;

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
  // Level 0 is a day without reviews; 1 to 4 scale with the review count.
  const level = (n: number) => (n === 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4);

  const total = days.reduce((sum, d) => sum + d.reviews, 0);
  const monthName = monthFormat.format(new Date(Date.UTC(year, monthIndex, 1)));

  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = month + "-" + String(day).padStart(2, "0");
    const dayLabel = dayFormat.format(new Date(Date.UTC(year, monthIndex, day)));
    const isFuture = date > today;
    const reviews = byDate.get(date) ?? 0;
    const countLabel = reviews === 0 ? "No reviews" : reviews + " review" + (reviews === 1 ? "" : "s");

    return (
      <span
        key={day}
        className={cx("d", isFuture ? "fut" : "l" + level(reviews), date === today && "is-today")}
        title={isFuture ? dayLabel : countLabel + " · " + dayLabel}
      />
    );
  });

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="heat" role="img" aria-label={"Study activity for " + monthName + ": " + total + " reviews"}>
        {WEEKDAYS.map((d, i) => (
          <span key={"w" + i} className="wd">
            {d}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={"p" + i} aria-hidden="true" />
        ))}
        {cells}
      </div>
      <div className="heat-legend" aria-hidden="true">
        <span>{total} reviews · </span>
        Less
        {LEGEND.map((color) => (
          <i key={color} style={{ background: color }} />
        ))}
        More
      </div>
    </div>
  );
}
