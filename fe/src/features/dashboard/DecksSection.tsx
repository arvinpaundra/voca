import { ChevronRight } from "lucide-react";
import type { DeckSummary } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import type { Loadable } from "./dashboardModel";

export function DecksSection({ state }: { state: Loadable<readonly DeckSummary[]> }) {
  if (state.kind === "loading") return <Skeleton label="Loading decks" rows={4} />;
  if (state.kind === "failed") return <ErrorState message="Couldn't load your decks." />;

  const top = [...state.value].sort((a, b) => b.dueCount - a.dueCount).slice(0, 3);

  return (
    <Card aria-label="Decks">
      <div className="card-head">
        <h2 className="h2">Your decks</h2>
        <a className="link" href="/app/decks">
          All decks
          <ChevronRight className="i" aria-hidden="true" />
        </a>
      </div>

      {top.length === 0 ? (
        <EmptyState
          title="No decks yet"
          action={
            <Button variant="primary" size="sm" href="/app/decks">
              Create deck
            </Button>
          }
        />
      ) : (
        <ul className="deck-grid">
          {top.map((deck) => (
            <li key={deck.slug}>
              <article className="deck">
                <div className="deck-top">
                  <a className="deck-title" href={`/app/decks/${deck.slug}`}>
                    {deck.title}
                  </a>
                </div>

                <div className="deck-tags">
                  <Badge variant="outline" lang>
                    {`${deck.termLang} → ${deck.meaningLang}`}
                  </Badge>
                </div>

                <div className="deck-stats">
                  <div>
                    <span className="due num">{deck.dueCount}</span>
                    <small>due</small>
                  </div>
                  <div className="words-col">
                    <span className="words num">{deck.wordCount}</span>
                    <small>words</small>
                  </div>
                </div>

                <div className="deck-foot">
                  <Button
                    variant="secondary"
                    size="sm"
                    href={`/app/decks/${deck.slug}/study`}
                    aria-label={`Study ${deck.title}`}
                  >
                    Study
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
