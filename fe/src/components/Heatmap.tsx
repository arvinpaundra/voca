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

// Level 0 is a day without reviews; 1 to 4 scale with the review count, from light lime to full lime.
function levelClass(level: number): string {
  if (level === 1) return "bg-lime/30 text-stone-900";
  if (level === 2) return "bg-lime/55 text-stone-900";
  if (level === 3) return "bg-lime/80 text-stone-900";
  if (level === 4) return "bg-lime text-stone-900";
  return "bg-stone-200 text-stone-500";
}

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
        className={cx(
          "flex aspect-square items-center justify-center rounded-[3px] text-[11px] leading-none",
          isFuture ? "border border-dashed border-stone-300 text-stone-400" : levelClass(level(reviews)),
        )}
        title={isFuture ? dayLabel : `${countLabel} · ${dayLabel}`}
      >
        {day}
      </span>
    );
  });

  return (
    <div className="grid gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <strong className="text-lg font-medium">{monthName}</strong>
        <span className="label">{total} reviews</span>
      </div>
      <div
        className="grid grid-cols-7 gap-1 text-[11px]"
        role="img"
        aria-label={`Study activity for ${monthName}: ${total} reviews`}
      >
        {WEEKDAYS.map((d, i) => (
          <span key={`w${i}`} className="text-center text-stone-500">
            {d}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`p${i}`} className="invisible" aria-hidden="true" />
        ))}
        {cells}
      </div>
      <div className="flex items-center justify-end gap-[3px] text-[11px] text-stone-500" aria-hidden="true">
        <span>Less</span>
        <span className={cx("size-[11px] rounded-[2px]", levelClass(0))} />
        <span className={cx("size-[11px] rounded-[2px]", levelClass(1))} />
        <span className={cx("size-[11px] rounded-[2px]", levelClass(2))} />
        <span className={cx("size-[11px] rounded-[2px]", levelClass(3))} />
        <span className={cx("size-[11px] rounded-[2px]", levelClass(4))} />
        <span>More</span>
      </div>
    </div>
  );
}
