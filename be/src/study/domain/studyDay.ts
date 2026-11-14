import { DateTime, Effect } from "effect"

/** The Learner's study day: from `dayStartHour` local time to the same hour on the next calendar day. */
export interface StudyDay {
  readonly start: DateTime.Utc
  readonly end: DateTime.Utc
}

/** The study day `now` falls in, for an IANA timezone and a day start hour (0–23). DST-aware. */
export const studyDay = (_now: DateTime.Utc, _timezone: string, _dayStartHour: number): StudyDay =>
  Effect.runSync(Effect.die("not implemented: SB"))

/** The start of the study day `days` calendar days after `day` in that timezone: where a due date lands. */
export const dueAfter = (_day: StudyDay, _timezone: string, _dayStartHour: number, _days: number): DateTime.Utc =>
  Effect.runSync(Effect.die("not implemented: SB"))
