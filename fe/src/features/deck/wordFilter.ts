import type { DateTime } from "effect";
import type { WordWithCards } from "@voca/contract";

export type WordFilter = "all" | "due" | "new" | "hard";

/** Whether a word belongs under a filter, judged from its Cards at `now`. */
export const matchesWordFilter = (_word: WordWithCards, _filter: WordFilter, _now: DateTime.Utc): boolean => {
  throw new Error("not implemented: LF");
};
