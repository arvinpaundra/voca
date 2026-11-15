import { ArrowRight, BookOpen, Plus } from "lucide-react";
import type { DeckSummary } from "@voca/contract";
import { Button } from "../../components/Button";
import type { Loadable } from "./useLoadable";

const SHOWN = 6;

export function DecksSection({ state }: { state: Loadable<readonly DeckSummary[]> }) {
  if (state.kind === "loading") return <p className="text-sm text-stone-500">Loading decks…</p>;
  if (state.kind === "failed") return <p className="text-sm text-stone-500">Couldn't load your decks.</p>;

  const shown = [...state.value].sort((a, b) => b.dueCount - a.dueCount).slice(0, SHOWN);

  return (
    <section aria-label="My decks" className="grid min-w-0 gap-4">
      <div className="flex items-center justify-between gap-3">
        <a
          className="inline-flex items-center gap-1.5 font-montserrat text-lg font-semibold text-stone-900 no-underline hover:text-stone-700"
          href="/app/decks"
        >
          My decks
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </a>
        <Button variant="accent" size="sm" href="/app/decks" className="rounded-full">
          <Plus className="size-4 shrink-0" aria-hidden />
          Add deck
        </Button>
      </div>

      {shown.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
          <BookOpen className="size-8 text-stone-300" aria-hidden />
          <p className="font-semibold text-stone-900">No decks yet</p>
          <p className="text-sm text-stone-500">Create your first deck to start learning.</p>
          <Button variant="accent" href="/app/decks">
            Create deck
          </Button>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {shown.map((deck) => (
          <li key={deck.slug} className="min-w-0">
            <article className="flex h-full flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
              <a
                className="truncate font-semibold text-stone-900 no-underline"
                href={`/app/decks/${deck.slug}`}
                dir="auto"
              >
                {deck.title}
              </a>
              <p className="text-xs text-stone-500">
                {deck.termLang} → {deck.meaningLang}
              </p>
              <p className="mt-auto text-xs text-stone-500">
                {deck.wordCount} words · {deck.dueCount} due
              </p>
              {deck.dueCount > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  className="self-start"
                  href={`/app/decks/${deck.slug}/study`}
                  aria-label={`Study ${deck.title}`}
                >
                  Study
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              )}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
