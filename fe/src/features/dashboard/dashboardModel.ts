import type { UseQueryResult } from "@tanstack/react-query";
import { DateTime } from "effect";
import type { LearnerStats } from "@voca/contract";

// One dashboard section's data: each section shows its own skeleton or message, so one failed query leaves the rest.
export type Loadable<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "loaded"; readonly value: T };

/** The section state of a query: failed on error, loaded once data is there, loading before that. */
export const loadableOf = <T>(query: UseQueryResult<T, unknown>): Loadable<T> => {
  if (query.isError) return { kind: "failed" };

  if (query.isSuccess) return { kind: "loaded", value: query.data };

  return { kind: "loading" };
};

/** The study date ("YYYY-MM-DD") `now` falls on: the local date in `timezone`, minus a day before `dayStartHour`. */
export const studyDate = (now: DateTime.Utc, timezone: string, dayStartHour: number): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(DateTime.toEpochMillis(now));

  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);

  const year = part("year");
  const month = part("month");
  const day = part("day");
  const hour = part("hour");

  // Before the day start hour the Learner is still on the previous study day.
  const studyDay = hour < dayStartHour ? day - 1 : day;

  return new Date(Date.UTC(year, month - 1, studyDay)).toISOString().slice(0, 10);
};

/** The month ("YYYY-MM") `delta` months away from `month`. */
export const shiftMonth = (month: string, delta: number): string => {
  const year = Number(month.slice(0, 4));
  const monthOfYear = Number(month.slice(5, 7));

  // Count months from year 0 so that negative steps wrap across year boundaries.
  const index = year * 12 + (monthOfYear - 1) + delta;
  const shiftedYear = Math.floor(index / 12);
  const shiftedMonth = index - shiftedYear * 12 + 1;

  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth).padStart(2, "0")}`;
};

/** The single weekday letter of a "YYYY-MM-DD" date. */
export const weekdayLetter = (date: string): string =>
  ["S", "M", "T", "W", "T", "F", "S"][new Date(`${date}T00:00:00.000Z`).getUTCDay()] ?? "";

/** "Wednesday, 18 November" for a "YYYY-MM-DD" date. */
export const longDate = (date: string): string => {
  const at = new Date(`${date}T00:00:00.000Z`);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(at);
  const dayAndMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(at);

  return `${weekday}, ${dayAndMonth}`;
};

/** "Oct 20" for a "YYYY-MM-DD" date. */
export const shortDate = (date: string): string =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`),
  );

/** The local hour (0-23) of `now` in `timezone`. */
export const localHour = (now: DateTime.Utc, timezone: string): number =>
  Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" })
      .formatToParts(DateTime.toEpochMillis(now))
      .find((part) => part.type === "hour")?.value,
  );

/** The line under the streak count. */
export const streakMessage = (streak: LearnerStats["streak"]): string => {
  if (streak.days === 0) return "Study today to start a streak";

  if (streak.studiedToday) return `${streak.days}-day streak. See you tomorrow`;

  return `Study today to keep your ${streak.days}-day streak`;
};
