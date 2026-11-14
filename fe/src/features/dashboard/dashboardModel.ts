import type { DateTime } from "effect";
import type { LearnerStats } from "@voca/contract";

/** The study date ("YYYY-MM-DD") `now` falls on: the local date in `timezone`, minus a day before `dayStartHour`. */
export const studyDate = (_now: DateTime.Utc, _timezone: string, _dayStartHour: number): string => {
  throw new Error("not implemented: IF");
};

/** The month ("YYYY-MM") `delta` months away from `month`. */
export const shiftMonth = (_month: string, _delta: number): string => {
  throw new Error("not implemented: IF");
};

/** The line under the streak count. */
export const streakMessage = (_streak: LearnerStats["streak"]): string => {
  throw new Error("not implemented: IF");
};
