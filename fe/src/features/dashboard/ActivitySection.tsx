import { useState } from "react";
import { DateTime } from "effect";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Learner } from "@voca/contract";
import { Card } from "../../components/Card";
import { cx } from "../../components/cx";
import { ErrorState } from "../../components/ErrorState";
import { IconButton } from "../../components/IconButton";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { shiftMonth, studyDate } from "./dashboardModel";
import { useLoadable } from "./useLoadable";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

// The legend swatches, level 0 to 4: the colours console.css gives `.heat .d` and `.l1` to `.l4`.
const LEGEND = ["#efeeed", "#e6ffc7", "#d4ffa0", "#c1ff72", "#8fd43a"] as const;

const monthName = (month: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)),
  );

function Heat({
  month,
  days,
  today,
}: {
  month: string;
  days: ReadonlyArray<{ date: string; reviews: number }>;
  today: string;
}) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leading = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();

  const byDate = new Map(days.map((d) => [d.date, d.reviews]));
  const active = days.map((d) => d.reviews).sort((a, b) => a - b);
  const quartile = (f: number) => active[Math.floor(f * (active.length - 1))] ?? 0;
  const q1 = quartile(0.25);
  const q2 = quartile(0.5);
  const q3 = quartile(0.75);
  // Level 0 is a day without reviews; 1 to 4 scale with the review count.
  const level = (n: number) => (n === 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4);

  const total = days.reduce((sum, d) => sum + d.reviews, 0);

  return (
    <>
      <div className="heat" role="img" aria-label={`Study activity for ${monthName(month)}: ${total} reviews`}>
        {WEEKDAYS.map((d, i) => (
          <span key={`w${i}`} className="wd">
            {d}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`p${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const reviews = byDate.get(date) ?? 0;

          return (
            <span
              key={date}
              className={cx("d", date > today ? "fut" : `l${level(reviews)}`, date === today && "is-today")}
              title={`${reviews} reviews · ${date}`}
            />
          );
        })}
      </div>

      <div className="heat-legend" aria-hidden="true">
        <span>{total} reviews · </span>
        Less
        {LEGEND.map((color) => (
          <i key={color} style={{ background: color }} />
        ))}
        More
      </div>
    </>
  );
}

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

  return (
    <Card aria-label="Activity">
      <div className="card-head">
        <h2 className="h2">Activity</h2>
        <span className="mnav">
          <IconButton
            label="Previous month"
            disabled={month <= signUpMonth}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft className="i" aria-hidden="true" />
          </IconButton>
          <b>{monthName(month)}</b>
          <IconButton
            label="Next month"
            disabled={month >= currentMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight className="i" aria-hidden="true" />
          </IconButton>
        </span>
      </div>

      {activity.kind === "loading" && <Skeleton label="Loading activity" rows={3} />}
      {activity.kind === "failed" && <ErrorState message="Couldn't load activity." />}
      {activity.kind === "loaded" && <Heat month={month} days={activity.value.days} today={today} />}
    </Card>
  );
}
