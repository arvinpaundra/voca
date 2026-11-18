import type { DeckStats } from "@voca/contract";

/** "About 12 minutes" for the queue, or null when no pace has been measured yet. */
export const estimateText = (minutes: number | null): string | null => {
  throw new Error("not implemented: CAUGHT");
};

/** The first of the next 7 study days that has cards falling due, or null when none has. */
export const nextDueDate = (forecast: DeckStats["forecast"]): string | null => {
  throw new Error("not implemented: CAUGHT");
};
