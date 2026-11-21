import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateTime } from "effect";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Learner } from "@voca/contract";
import { Card } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { Heatmap } from "../../components/Heatmap";
import { IconButton } from "../../components/IconButton";
import { Skeleton } from "../../components/Skeleton";
import { activityQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { loadableOf, shiftMonth, studyDate } from "./dashboardModel";

const monthName = (month: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)),
  );

export function ActivitySection({ learner }: { learner: Learner }) {
  const { timezone, dayStartHour } = learner.settings;

  // Frozen at mount: the month navigation and the "today" outline stay consistent while the page is open.
  const [today] = useState(() => studyDate(DateTime.nowUnsafe(), timezone, dayStartHour));
  const signUpMonth = studyDate(learner.createdAt, timezone, dayStartHour).slice(0, 7);
  const currentMonth = today.slice(0, 7);

  const [month, setMonth] = useState(currentMonth);
  // Each month is its own query: a month seen before renders from the cache, and the others load on first visit.
  const activity = loadableOf(useQuery(activityQuery(month), queryClient));

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
      {activity.kind === "loaded" && <Heatmap month={month} days={activity.value.days} today={today} />}
    </Card>
  );
}
