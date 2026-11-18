import type { DeckSummary } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import type { Loadable } from "./useLoadable";

const SHOWN = 6;

export function DecksSection({ state }: { state: Loadable<readonly DeckSummary[]> }) {
  if (state.kind === "loading") {
    return <Skeleton label="Loading decks" rows={3} />;
  }

  if (state.kind === "failed") {
    return <ErrorState message="Couldn't load your decks." />;
  }

  const shown = [...state.value].sort((a, b) => b.dueCount - a.dueCount).slice(0, SHOWN);

  return (
    <section className="grid min-w-0 gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-stone-500 uppercase">My decks</h2>
        <a className="text-sm text-stone-700 underline-offset-2 hover:underline" href="/app/decks">
          All decks
        </a>
      </div>

      {shown.length === 0 && (
        <EmptyState
          title="No decks yet"
          body="Create your first deck to start learning."
          action={
            <Button variant="secondary" size="sm" href="/app/decks">
              Create deck
            </Button>
          }
        />
      )}

      {shown.length > 0 && (
        <div className="overflow-hidden rounded-card border border-stone-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">My decks</caption>
            <thead>
              <tr className="h-8 border-b border-stone-200 text-left text-[11px] tracking-[0.06em] text-stone-500 uppercase">
                <th scope="col" className="px-4 font-semibold">
                  Deck
                </th>
                <th scope="col" className="px-4 text-right font-semibold">
                  Due
                </th>
                <th scope="col" className="px-4 text-right font-semibold">
                  Words
                </th>
                <th scope="col" className="px-4 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((deck) => (
                <tr key={deck.slug} className="h-11 border-t border-stone-200 first:border-t-0 hover:bg-stone-50">
                  <td className="min-w-0 px-4">
                    <a
                      className="block truncate font-medium text-stone-900 no-underline hover:underline"
                      href={`/app/decks/${deck.slug}`}
                      dir="auto"
                    >
                      {deck.title}
                    </a>
                  </td>
                  <td className="px-4 text-right font-mono tabular-nums text-stone-900">{deck.dueCount}</td>
                  <td className="px-4 text-right font-mono tabular-nums text-stone-500">{deck.wordCount}</td>
                  <td className="px-4 text-right">
                    {deck.dueCount > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        href={`/app/decks/${deck.slug}/study`}
                        aria-label={`Study ${deck.title}`}
                      >
                        Study
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
