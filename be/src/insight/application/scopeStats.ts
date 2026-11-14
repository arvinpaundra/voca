import { Effect } from "effect"
import type { DeckStats } from "@voca/contract"
import { clockOf, datesFrom, shiftDate, type Calendar } from "./calendar.ts"
import { InsightRepo, type DayCount, type Scope } from "./insightRepo.ts"

/** A card is mature from this many days of stability. */
const MATURE_DAYS = 21

/** The retention, calibration and reviews-per-day window: today and the 29 study days before it. */
const WINDOW_DAYS = 30

const FORECAST_DAYS = 7

const countsByDate = (rows: ReadonlyArray<DayCount>): ReadonlyMap<string, number> =>
  new Map(rows.map((row) => [row.date, row.count] as const))

/** `DeckStats` over one scope: a deck, or every live deck of the Learner. */
export const scopeStats = (scope: Scope, calendar: Calendar): Effect.Effect<DeckStats, never, InsightRepo> =>
  Effect.gen(function* () {
    const repo = yield* InsightRepo
    const clock = clockOf(calendar)
    const windowStart = shiftDate(calendar.today, 1 - WINDOW_DAYS)
    const forecastStart = shiftDate(calendar.today, 1)
    const forecastEnd = shiftDate(calendar.today, FORECAST_DAYS)

    const cards = yield* repo.cardMaturity(scope, MATURE_DAYS)
    const unstudied = yield* repo.unstudiedPairs(scope)
    const due = yield* repo.dueCounts(scope, calendar.day.start, calendar.day.end)
    const forecast = countsByDate(yield* repo.dueForecast(scope, clock, forecastStart, forecastEnd))
    const retention = yield* repo.reviewStats(scope, clock, windowStart, calendar.today)
    const reviewed = countsByDate(yield* repo.reviewDays(scope, clock, calendar.today))

    const actual = retention.total === 0 ? null : retention.correct / retention.total

    return {
      maturity: { new: unstudied, learning: cards.learning, mature: cards.mature },
      dueToday: due.due,
      overdue: due.overdue,
      forecast: datesFrom(forecastStart, FORECAST_DAYS).map((date) => ({ date, count: forecast.get(date) ?? 0 })),
      trueRetention: actual,
      calibration:
        actual === null || retention.predicted === null ? null : { predicted: retention.predicted, actual },
      reviewsPerDay: datesFrom(windowStart, WINDOW_DAYS).map((date) => ({ date, count: reviewed.get(date) ?? 0 }))
    }
  })
