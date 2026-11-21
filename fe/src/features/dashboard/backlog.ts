import type { DeckSummary, SessionSize } from "@voca/contract";

const MIN_BACKLOG = 30;
const BACKLOG_SESSIONS = 3;

// Small sessions still need a floor: at size 7, 3 × 7 = 21 would flag decks that are not really behind.
const backlogThreshold = (sessionSize: SessionSize): number => Math.max(BACKLOG_SESSIONS * sessionSize, MIN_BACKLOG);

/** The decks that are not snoozed and have more due than max(3 × the session size, 30), in the list's order. */
export const backlogDecks = (decks: readonly DeckSummary[], sessionSize: SessionSize): readonly DeckSummary[] => {
  const threshold = backlogThreshold(sessionSize);

  return decks.filter((deck) => deck.snooze === null && deck.dueCount > threshold);
};
