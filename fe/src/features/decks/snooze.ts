import type { DeckSnooze } from "@voca/contract";

/**
 * What a deck says about its snooze: "Snoozed until Sat 28 Nov" (the end's date in the Learner's timezone),
 * "Snoozed" when it lasts until unsnoozed, and null when the deck is awake.
 */
export const snoozeLabel = (_snooze: DeckSnooze | null | undefined, _timezone: string): string | null =>
  "not implemented: FD";
