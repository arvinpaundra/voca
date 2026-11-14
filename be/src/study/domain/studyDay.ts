import { DateTime } from "effect"

/** The Learner's study day: from `dayStartHour` local time to the same hour on the next calendar day. */
export interface StudyDay {
  readonly start: DateTime.Utc
  readonly end: DateTime.Utc
}

interface CalendarDay {
  readonly year: number
  readonly month: number
  readonly day: number
}

const addDays = (date: CalendarDay, days: number): CalendarDay => {
  const base = DateTime.makeUnsafe({ year: date.year, month: date.month, day: date.day })
  const shifted = DateTime.toPartsUtc(DateTime.add(base, { days }))

  return { year: shifted.year, month: shifted.month, day: shifted.day }
}

/** The calendar date `instant` falls on in `timezone`. */
const localDate = (instant: DateTime.Utc, timezone: string): CalendarDay & { readonly hour: number } => {
  const parts = DateTime.toParts(DateTime.makeZonedUnsafe(instant, { timeZone: timezone }))

  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour }
}

/** The instant the study day of `date` starts. In a DST gap the later time is taken, in a repeat the earlier one. */
const dayStartOf = (date: CalendarDay, timezone: string, dayStartHour: number): DateTime.Utc =>
  DateTime.toUtc(
    DateTime.makeZonedUnsafe(
      { year: date.year, month: date.month, day: date.day, hour: dayStartHour },
      { timeZone: timezone, adjustForTimeZone: true, disambiguation: "compatible" }
    )
  )

/** The study day `now` falls in, for an IANA timezone and a day start hour (0–23). DST-aware. */
export const studyDay = (now: DateTime.Utc, timezone: string, dayStartHour: number): StudyDay => {
  const local = localDate(now, timezone)
  const today = { year: local.year, month: local.month, day: local.day }
  const date = local.hour < dayStartHour ? addDays(today, -1) : today

  return {
    start: dayStartOf(date, timezone, dayStartHour),
    end: dayStartOf(addDays(date, 1), timezone, dayStartHour)
  }
}

/** The start of the study day `days` calendar days after `day` in that timezone: where a due date lands. */
export const dueAfter = (day: StudyDay, timezone: string, dayStartHour: number, days: number): DateTime.Utc => {
  const start = localDate(day.start, timezone)
  const target = addDays({ year: start.year, month: start.month, day: start.day }, days)

  return dayStartOf(target, timezone, dayStartHour)
}
