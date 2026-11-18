import { Flame } from "lucide-react";
import type { LearnerStats } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { streakMessage } from "./dashboardModel";
import type { Loadable } from "./useLoadable";

export function StreakSection({ state }: { state: Loadable<LearnerStats> }) {
  if (state.kind === "loading") {
    return <Skeleton label="Loading streak" rows={2} />;
  }

  if (state.kind === "failed") {
    return <ErrorState message="Couldn't load your streak." />;
  }

  const { streak } = state.value;
  const isOnRoll = streak.days >= 7;

  return (
    <section
      aria-label="Streak"
      className="flex flex-col gap-3 rounded-card border border-stone-200 bg-white p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-stone-500 uppercase">Streak</h2>
        <Flame className="size-4 shrink-0 text-stone-500" aria-hidden />
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-4xl leading-none font-semibold tabular-nums text-stone-900">{streak.days}</span>
        <span className="text-sm text-stone-500">{streak.days === 1 ? "day" : "days"}</span>
        {isOnRoll && <Badge variant="lime">On a roll!</Badge>}
      </div>

      <p className="text-sm text-stone-500">{streakMessage(streak)}</p>
    </section>
  );
}
