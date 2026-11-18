import { DateTime } from "effect";

export const dash = "—";

// Instants may arrive as DateTime or as ISO text, so both go through makeUnsafe.
export const instantMillis = (instant: unknown): number => DateTime.toEpochMillis(DateTime.makeUnsafe(instant as string));

const partsOf = (millis: number, timezone: string, options: Intl.DateTimeFormatOptions) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hourCycle: "h23", ...options }).formatToParts(millis);

  return (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
};

/** "Sat 21" */
export const dueDay = (instant: unknown, timezone: string): string => {
  const part = partsOf(instantMillis(instant), timezone, { weekday: "short", day: "numeric" });

  return `${part("weekday")} ${part("day")}`;
};

/** "18 Nov" */
export const shortDate = (instant: unknown, timezone: string): string => {
  const part = partsOf(instantMillis(instant), timezone, { day: "numeric", month: "short" });

  return `${part("day")} ${part("month")}`;
};

/** "18 Nov 09:04" */
export const dateTime = (instant: unknown, timezone: string): string => {
  const part = partsOf(instantMillis(instant), timezone, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${part("day")} ${part("month")} ${part("hour")}:${part("minute")}`;
};

// Calendar days in the timezone, counted from the local date, not from 24-hour spans.
const calendarDay = (millis: number, timezone: string): number => {
  const part = partsOf(millis, timezone, { year: "numeric", month: "numeric", day: "numeric" });

  return Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day"))) / 86_400_000;
};

/** Calendar days from `now` to `instant` in the Learner's timezone. */
export const daysUntil = (instant: unknown, now: DateTime.Utc, timezone: string): number =>
  calendarDay(instantMillis(instant), timezone) - calendarDay(DateTime.toEpochMillis(now), timezone);

export const percent = (ratio: number | null): string => (ratio === null ? dash : `${Math.round(ratio * 100)}%`);

export const stability = (stabilityDays: number | null): string =>
  stabilityDays === null ? dash : `${stabilityDays.toFixed(1)}d`;

export const difficultyBand = (difficulty: number | null): string => {
  if (difficulty === null) return dash;
  if (difficulty < 4) return "Easy";
  if (difficulty < 7) return "Medium";
  return "Hard";
};

export const seconds = (millis: number | null): string => (millis === null ? dash : `${(millis / 1000).toFixed(1)}s`);

export const times = (count: number): string => (count === 1 ? "1 time" : `${count} times`);

export const ratingLabel = (rating: number): string => ["Again", "Hard", "Good", "Easy"][rating - 1] ?? dash;

export const dayCount = (count: number | null): string => (count === null ? dash : `${count}d`);
