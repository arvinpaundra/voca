import { DateTime } from "effect";
import { useState } from "react";
import type { Learner, LearnerStats, Notifications } from "@voca/contract";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { StatStrip } from "../../components/StatStrip";
import { studyDate } from "./dashboardModel";
import type { Loadable } from "./useLoadable";

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

  if (state.kind === "loading") {
    return <Skeleton label="Loading today" rows={2} />;
  }

  if (state.kind === "failed") {
    return <ErrorState message="Couldn't load today." />;
  }

  const { decks, hardDue, newAvailable } = state.value;
  const [firstDeck] = decks;
  const totalDue = decks.reduce((sum, deck) => sum + deck.due, 0);
  const totalOverdue = decks.reduce((sum, deck) => sum + deck.overdue, 0);
  const reviewedToday =
    stats.kind === "loaded" ? String(stats.value.reviewsPerDay.find((day) => day.date === today)?.count ?? 0) : "—";
  const hasWork = totalDue > 0 || newAvailable > 0;

  let headline = "You're all caught up!";
  if (totalDue > 0) headline = `You have ${totalDue} cards to review.`;
  else if (newAvailable > 0) headline = `You have ${newAvailable} new cards to learn.`;

  const numbers = [
    { label: "Due", value: String(totalDue) },
    { label: "New", value: String(newAvailable) },
    { label: "Hard", value: String(hardDue) },
    { label: "Overdue", value: String(totalOverdue) },
    { label: "Reviewed", value: reviewedToday },
  ];

  return (
    <section aria-label="Today" className="grid min-w-0 gap-4 rounded-card border border-stone-200 bg-white p-6">
      <h2 className="font-montserrat text-lg font-semibold text-stone-900">{headline}</h2>

      <StatStrip stats={numbers} />

      {firstDeck !== undefined && hasWork && (
        <Button variant="primary" className="self-start" href={`/app/decks/${firstDeck.deckSlug}/study`}>
          Start studying
        </Button>
      )}

      {decks.length > 0 && (
        <ul className="grid divide-y divide-stone-200 border-t border-stone-200">
          {decks.map((deck) => (
            <li key={deck.deckSlug}>
              <a
                className="flex min-h-10 flex-wrap items-center justify-between gap-2 py-2 text-sm text-stone-900 no-underline hover:bg-stone-50"
                href={`/app/decks/${deck.deckSlug}/study`}
              >
                <span className="font-medium">{deck.title}</span>
                <span className="font-mono text-xs tabular-nums text-stone-500">
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
    </section>
  );
}
