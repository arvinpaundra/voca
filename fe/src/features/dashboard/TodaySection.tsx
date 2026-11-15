import { DateTime } from "effect";
import { useState } from "react";
import type { Learner, LearnerStats, Notifications } from "@voca/contract";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";
import { studyDate } from "./dashboardModel";
import type { Loadable } from "./useLoadable";

function Chip({ value, label, urgent = false }: { value: number | string; label: string; urgent?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        urgent ? "border-lime/30 bg-lime/10 text-lime" : "border-white/10 bg-white/10 text-white",
      )}
    >
      {value} {label}
    </span>
  );
}

export function TodaySection({
  state,
  stats,
  learner,
}: {
  state: Loadable<Notifications>;
  stats: Loadable<LearnerStats>;
  learner: Learner;
}) {
  // Frozen at mount so the "reviewed" count matches the study day the page opened on.
  const [today] = useState(() =>
    studyDate(DateTime.nowUnsafe(), learner.settings.timezone, learner.settings.dayStartHour),
  );

  if (state.kind === "loading") return <p className="text-sm text-stone-500">Loading today…</p>;
  if (state.kind === "failed") return <p className="text-sm text-stone-500">Couldn't load today.</p>;

  const { decks, hardDue, newAvailable } = state.value;
  const [firstDeck] = decks;
  const totalDue = decks.reduce((sum, deck) => sum + deck.due, 0);
  const totalOverdue = decks.reduce((sum, deck) => sum + deck.overdue, 0);
  const reviewedToday =
    stats.kind === "loaded" ? (stats.value.reviewsPerDay.find((day) => day.date === today)?.count ?? 0) : "—";
  const hasWork = totalDue > 0 || newAvailable > 0;

  let headline = "You're all caught up!";
  if (totalDue > 0) headline = `You have ${totalDue} cards to review.`;
  else if (newAvailable > 0) headline = `You have ${newAvailable} new cards to learn.`;

  return (
    <section aria-label="Today" className="relative overflow-hidden rounded-2xl bg-stone-900 p-8">
      <div className="pointer-events-none absolute -top-10 right-0 h-64 w-64 rounded-full bg-lime opacity-[0.06] blur-[80px]" />

      <div className="relative grid gap-5">
        <h2 className="font-montserrat text-2xl font-semibold text-white">{headline}</h2>

        <div className="flex flex-wrap gap-2">
          <Chip value={totalDue} label="due" urgent />
          <Chip value={newAvailable} label="new" />
          <Chip value={hardDue} label="hard" />
          <Chip value={totalOverdue} label="overdue" />
          <Chip value={reviewedToday} label="reviewed" />
        </div>

        {firstDeck !== undefined && hasWork && (
          <Button variant="primary" className="self-start" href={`/app/decks/${firstDeck.deckSlug}/study`}>
            Start studying
          </Button>
        )}

        {decks.length > 0 && (
          <ul className="grid gap-2">
            {decks.map((deck) => (
              <li key={deck.deckSlug}>
                <a
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-white no-underline transition-colors hover:bg-white/5"
                  href={`/app/decks/${deck.deckSlug}/study`}
                >
                  <span className="font-semibold">{deck.title}</span>
                  <span className="text-xs text-stone-400">
                    {deck.due} due
                    {deck.overdue > 0 && ` · ${deck.overdue} overdue`}
                    {deck.byDrill.length > 0 &&
                      ` · ${deck.byDrill.map((drill) => `${drill.label} ${drill.due}`).join(" · ")}`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
