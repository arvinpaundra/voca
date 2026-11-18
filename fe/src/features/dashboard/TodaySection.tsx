import { ArrowRight, ChevronRight } from "lucide-react";
import type { Learner, LearnerStats, Notifications } from "@voca/contract";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { StatStrip } from "../../components/StatStrip";
import type { Loadable } from "./useLoadable";

type QueueDeck = Notifications["decks"][number];

const studyHref = (deck: QueueDeck) => `/app/decks/${deck.deckSlug}/study`;

const queueMeta = (deck: QueueDeck): string => {
  if (deck.byDrill.length >= 2) return deck.byDrill.map((drill) => `${drill.label} ${drill.due}`).join(" · ");

  const [only] = deck.byDrill;

  if (only !== undefined) return only.label;

  return deck.overdue > 0 ? `${deck.overdue} overdue` : "";
};

function Headline({ due, fresh }: { due: number; fresh: number }) {
  if (due > 0 && fresh > 0) {
    return (
      <h2>
        You have <em>{due} cards</em> to review and {fresh} new words waiting.
      </h2>
    );
  }

  if (due > 0) {
    return (
      <h2>
        You have <em>{due} cards</em> to review.
      </h2>
    );
  }

  if (fresh > 0) {
    return (
      <h2>
        You have <em>{fresh} new words</em> waiting.
      </h2>
    );
  }

  return <h2>You're all caught up!</h2>;
}

export function TodaySection({
  state,
  stats,
}: {
  state: Loadable<Notifications>;
  stats: Loadable<LearnerStats>;
  learner: Learner;
}) {
  if (state.kind === "loading") return <Skeleton label="Loading today" rows={4} />;
  if (state.kind === "failed") return <ErrorState message="Couldn't load today." />;

  const { decks, hardDue, newAvailable } = state.value;
  const due = decks.reduce((sum, deck) => sum + deck.due, 0);
  const overdue = decks.reduce((sum, deck) => sum + deck.overdue, 0);
  const reviewedToday = stats.kind === "loaded" ? (stats.value.reviewsPerDay.at(-1)?.count ?? 0) : undefined;
  const first = decks[0];

  return (
    <section className="today" aria-label="Today">
      <span className="eyebrow">Today</span>
      <Headline due={due} fresh={newAvailable} />

      <StatStrip
        stats={[
          { label: "due", value: String(due), highlight: true },
          { label: "new", value: String(newAvailable) },
          { label: "hard", value: String(hardDue) },
          { label: "overdue", value: String(overdue) },
          { label: "reviewed today", value: reviewedToday === undefined ? "—" : String(reviewedToday) },
        ]}
      />

      {decks.length > 0 && (
        <ul className="queue">
          {decks.map((deck) => (
            <li key={deck.deckSlug}>
              <a href={studyHref(deck)}>
                <span className="qt">{deck.title}</span>
                <span className="qm">{queueMeta(deck)}</span>
                <span className="qn">{deck.due}</span>
                <ChevronRight className="i" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {first !== undefined && (
        <div className="today-cta">
          <Button variant="primary" href={studyHref(first)}>
            Start studying
            <ArrowRight className="i" aria-hidden="true" />
          </Button>
        </div>
      )}
    </section>
  );
}
