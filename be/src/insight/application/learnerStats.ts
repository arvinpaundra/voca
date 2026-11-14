import { Effect } from "effect"
import { CurrentLearner } from "@voca/contract"
import { clockOf, learnerCalendar, shiftDate } from "./calendar.ts"
import { InsightRepo } from "./insightRepo.ts"
import { scopeStats } from "./scopeStats.ts"

/** Consecutive study days with a review, counted back from today, or from yesterday while today has none. */
const streakAt = (studied: ReadonlySet<string>, today: string) => {
  const studiedToday = studied.has(today)
  let date = studiedToday ? today : shiftDate(today, -1)
  let days = 0

  while (studied.has(date)) {
    days += 1
    date = shiftDate(date, -1)
  }

  return { days, studiedToday }
}

/** `GET /me/stats`: `DeckStats` over every live deck of the Learner, and the study streak. */
export const learnerStats = Effect.gen(function* () {
  const { id: learnerId } = yield* CurrentLearner
  const repo = yield* InsightRepo
  const calendar = yield* learnerCalendar(learnerId)
  const scope = { learnerId, deckId: null }
  const stats = yield* scopeStats(scope, calendar)
  const reviewed = yield* repo.reviewDays(scope, clockOf(calendar), calendar.today)

  return {
    ...stats,
    streak: streakAt(new Set(reviewed.map((day) => day.date)), calendar.today)
  }
})
