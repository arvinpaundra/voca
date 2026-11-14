import type { DeckSummary } from "@voca/contract";

export type DeckSort = "recent" | "title" | "words" | "due";

export interface DeckFilter {
  readonly q: string;
  readonly termLang: string | null;
  readonly sort: DeckSort;
}

/** The term languages of the Learner's decks, for the language filter. */
export const termLangsOf = (decks: readonly DeckSummary[]): string[] =>
  [...new Set(decks.map((deck) => deck.termLang))].sort();

const normalize = (text: string): string => text.trim().toLowerCase();

const byTitle = (a: DeckSummary, b: DeckSummary): number => {
  const left = normalize(a.title);
  const right = normalize(b.title);

  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const comparators: Record<DeckSort, (a: DeckSummary, b: DeckSummary) => number> = {
  recent: (a, b) => b.updatedAt.epochMilliseconds - a.updatedAt.epochMilliseconds,
  title: byTitle,
  words: (a, b) => b.wordCount - a.wordCount || byTitle(a, b),
  due: (a, b) => b.dueCount - a.dueCount || byTitle(a, b)
};

/** The decks matching the search and the language, in the chosen order. */
export const filterDecks = (decks: readonly DeckSummary[], filter: DeckFilter): DeckSummary[] => {
  const query = normalize(filter.q);

  return decks
    .filter((deck) => query === "" || normalize(deck.title).includes(query))
    .filter((deck) => filter.termLang === null || deck.termLang === filter.termLang)
    .sort(comparators[filter.sort]);
};
