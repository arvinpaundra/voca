import { DateTime, Effect } from "effect"
import { studyDay, type StudyDay } from "../../study/domain/studyDay.ts"
import { InsightRepo, type Clock, type LearnerSettings } from "./insightRepo.ts"

/** The Learner's study calendar at the time of a read: today's study day and the study date that names it. */
export interface Calendar extends Clock {
  readonly newPerDay: number
  readonly day: StudyDay
  readonly today: string
}

const DAY_MS = 86_400_000

const pad = (value: number) => String(value).padStart(2, "0")

/** The calendar date an instant falls on in a timezone. */
const dateIn = (instant: DateTime.Utc, timezone: string): string => {
  const parts = DateTime.toParts(DateTime.makeZonedUnsafe(instant, { timeZone: timezone }))

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

/** A study day starts at the day start hour on its own study date, so the start's calendar date is that date. */
export const calendarAt = (now: DateTime.Utc, settings: LearnerSettings): Calendar => {
  const day = studyDay(now, settings.timezone, settings.dayStartHour)

  return {
    timezone: settings.timezone,
    dayStartHour: settings.dayStartHour,
    newPerDay: settings.newPerDay,
    day,
    today: dateIn(day.start, settings.timezone)
  }
}

/** The Learner's calendar now, read from the clock and the Learner's settings. */
export const learnerCalendar = (learnerId: bigint): Effect.Effect<Calendar, never, InsightRepo> =>
  Effect.gen(function* () {
    const repo = yield* InsightRepo
    const settings = yield* repo.learnerSettings(learnerId)

    return calendarAt(yield* DateTime.now, settings)
  })

export const clockOf = (calendar: Calendar): Clock => ({
  timezone: calendar.timezone,
  dayStartHour: calendar.dayStartHour
})

/** The study date `days` days after `date`. Study dates are calendar dates, so UTC arithmetic has no DST gaps. */
export const shiftDate = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

/** `count` consecutive study dates from `from`, oldest first. */
export const datesFrom = (from: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => shiftDate(from, index))
