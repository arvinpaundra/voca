import type { DeckSummary } from "@voca/contract";

export type DeckSort = "recent" | "title" | "words" | "due";

export interface DeckFilter {
  readonly q: string;
  readonly termLang: string | null;
  readonly sort: DeckSort;
}

/** The term languages of the Learner's decks, for the language filter. */
export const termLangsOf = (_decks: readonly DeckSummary[]): string[] => {
  throw new Error("not implemented: LF");
};

/** The decks matching the search and the language, in the chosen order. */
export const filterDecks = (_decks: readonly DeckSummary[], _filter: DeckFilter): DeckSummary[] => {
  throw new Error("not implemented: LF");
};
