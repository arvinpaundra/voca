import { Flame } from "lucide-react";
import type { LearnerStats } from "@voca/contract";
import { streakMessage } from "./dashboardModel";
import type { Loadable } from "./useLoadable";

export function StreakSection({ state }: { state: Loadable<LearnerStats> }) {
  if (state.kind === "loading") return <p className="text-sm text-stone-500">Loading your streak…</p>;
  if (state.kind === "failed") return <p className="text-sm text-stone-500">Couldn't load your streak.</p>;

  const { streak } = state.value;
  const isZero = streak.days === 0;
  const isOnRoll = streak.days >= 7;

  return (
    <section
      aria-label="Streak"
      className="relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl bg-stone-900 p-6 text-center"
    >
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-lime opacity-10 blur-[40px]" />
      <Flame className="relative z-10 size-7 shrink-0 text-orange-400" aria-hidden />
      <span
        className={`relative z-10 font-montserrat text-6xl leading-none font-bold ${
          isZero ? "text-stone-500" : "text-lime"
        }`}
      >
        {streak.days}
      </span>
      <span className="relative z-10 text-xs tracking-wide text-stone-400 uppercase">
        {isZero ? "Start your streak today" : "day streak"}
      </span>
      {isOnRoll && (
        <span className="relative z-10 rounded-full bg-lime px-2 py-0.5 text-xs font-medium text-stone-900">
          On a roll!
        </span>
      )}
      <p className="relative z-10 text-xs text-stone-400">{streakMessage(streak)}</p>
    </section>
  );
}
