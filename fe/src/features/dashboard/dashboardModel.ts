import { DateTime } from "effect";
import type { LearnerStats } from "@voca/contract";

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

/** The line under the streak count. */
export const streakMessage = (streak: LearnerStats["streak"]): string => {
  if (streak.days === 0) return "Study today to start a streak";

  if (streak.studiedToday) return `${streak.days}-day streak. See you tomorrow`;

  return `Study today to keep your ${streak.days}-day streak`;
};
