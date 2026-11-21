import { DateTime } from "effect";
import type { DeckSnooze } from "@voca/contract";
import { dayLabel } from "../../components/dateLabel";

// The calendar date ("YYYY-MM-DD") an instant falls on in `timezone`; the end is shown on the Learner's day, not UTC's.
const localDate = (instant: DateTime.Utc, timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(DateTime.toEpochMillis(instant));

  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
};

/**
 * What a deck says about its snooze: "Snoozed until Sat 28 Nov" (the end's date in the Learner's timezone),
 * "Snoozed" when it lasts until unsnoozed, and null when the deck is awake.
 */
export const snoozeLabel = (snooze: DeckSnooze | null | undefined, timezone: string): string | null => {
  if (snooze == null) return null;

  if (snooze.until === null) return "Snoozed";

  return `Snoozed until ${dayLabel(localDate(snooze.until, timezone))}`;
};

/**
 * The short text a snoozed row shows beside its moon: "until 28 Nov" (the end's date in the Learner's timezone),
 * "Snoozed" when it lasts until unsnoozed, and null when the deck is awake. `snoozeLabel` is the full text.
 */
export const snoozeShortLabel = (_snooze: DeckSnooze | null | undefined, _timezone: string): string | null =>
  "not implemented: FD2";
