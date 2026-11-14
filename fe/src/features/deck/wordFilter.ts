import { DateTime } from "effect";
import type { WordWithCards } from "@voca/contract";

export type WordFilter = "all" | "due" | "new" | "hard";

/** Whether a word belongs under a filter, judged from its Cards at `now`. */
export const matchesWordFilter = (word: WordWithCards, filter: WordFilter, now: DateTime.Utc): boolean => {
  switch (filter) {
    case "all":
      return true;

    case "due":
      return word.cards.some((card) => DateTime.toEpochMillis(card.due) <= DateTime.toEpochMillis(now));

    case "new":
      return word.cards.length === 0;

    case "hard":
      return word.cards.some((card) => card.isHard);
  }
};
