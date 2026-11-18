import { Flame } from "lucide-react";
import type { LearnerStats } from "@voca/contract";
import { Card } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { weekdayLetter } from "./dashboardModel";
import type { Loadable } from "./useLoadable";

export function StreakSection({ state }: { state: Loadable<LearnerStats> }) {
  if (state.kind === "loading") return <Skeleton label="Loading streak" rows={2} />;
  if (state.kind === "failed") return <ErrorState message="Couldn't load your streak." />;

  const { streak, reviewsPerDay } = state.value;
  const week = reviewsPerDay.slice(-7);

  return (
    <Card aria-label="Streak">
      <div className="streak">
        <span className="flame">
          <Flame className="i i-lg" aria-hidden="true" />
        </span>
        <div>
          <div className="v num">{streak.days}</div>
          <div className="l">day streak</div>
        </div>
      </div>

      <div className="week">
        {week.map((day, index) => {
          const isToday = index === week.length - 1;
          const done = isToday ? streak.studiedToday : day.count > 0;

          return (
            <div key={day.date}>
              <i className={done ? "done" : isToday ? "now" : undefined}></i>
              {weekdayLetter(day.date)}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
