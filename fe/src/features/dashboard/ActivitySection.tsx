import { useState } from "react";
import { DateTime } from "effect";
import type { Learner } from "@voca/contract";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Heatmap } from "../../components/Heatmap";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { shiftMonth, studyDate } from "./dashboardModel";
import { useLoadable } from "./useLoadable";

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
    <section aria-label="Activity" className="grid min-w-0 gap-4 rounded-card border border-stone-200 bg-white p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-stone-500 uppercase">Activity</h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous month"
            disabled={!canGoBack}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            ‹
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Next month"
            disabled={!canGoForward}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ›
          </Button>
        </div>
      </div>

      {activity.kind === "loading" && <Skeleton label="Loading activity" rows={3} />}
      {activity.kind === "failed" && <ErrorState message="Couldn't load activity." />}
      {activity.kind === "loaded" && <Heatmap month={month} days={activity.value.days} today={today} />}
    </section>
  );
}
