import type { DeckSummary, SessionSize } from "@voca/contract";

/** The decks that are not snoozed and have more due than max(3 × the session size, 30), in the list's order. */
export const backlogDecks = (_decks: readonly DeckSummary[], _sessionSize: SessionSize): readonly DeckSummary[] => {
  throw new Error("not implemented: BH");
};
