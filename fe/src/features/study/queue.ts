import type { Drill, Question } from "@voca/contract";

/** A retried word comes back this many questions after the one answered wrong. */
export const RETRY_GAP = 3;

/**
 * The pending questions after the head was answered: the head leaves, and a retry (if any) goes
 * RETRY_GAP questions later, or last when fewer questions remain.
 */
export const advance = (_queue: readonly Question[], _retry: Question | null): Question[] => {
  throw new Error("not implemented: SF");
};

/** The drills to preselect for a deck: the last set started there, kept to those still available. */
export const rememberedDrills = (_storage: Storage, _deckSlug: string, _available: readonly Drill[]): Drill[] => {
  throw new Error("not implemented: SF");
};

export const rememberDrills = (_storage: Storage, _deckSlug: string, _drills: readonly Drill[]): void => {
  throw new Error("not implemented: SF");
};
