import { useState } from "react";
import { DateTime } from "effect";
import type { Learner } from "@voca/contract";
import { Heatmap } from "../../components/Heatmap";
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

  const navButton =
    "rounded-lg border border-stone-200 bg-white px-2.5 py-0.5 text-stone-700 hover:bg-stone-100 disabled:cursor-default disabled:opacity-40";

  return (
    <section aria-label="Activity" className="grid min-w-0 gap-4 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex justify-end gap-2">
        <button
          className={navButton}
          type="button"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          ‹
        </button>
        <button
          className={navButton}
          type="button"
          aria-label="Next month"
          disabled={!canGoForward}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          ›
        </button>
      </div>

      {activity.kind === "loading" && <p className="text-sm text-stone-500">Loading activity…</p>}
      {activity.kind === "failed" && <p className="text-sm text-stone-500">Couldn't load activity.</p>}
      {activity.kind === "loaded" && <Heatmap month={month} days={activity.value.days} today={today} />}
    </section>
  );
}
