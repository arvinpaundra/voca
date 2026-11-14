import { Effect } from "effect"
import { CurrentLearner } from "@voca/contract"
import { clockOf, learnerCalendar } from "./calendar.ts"
import { InsightRepo } from "./insightRepo.ts"

/** `GET /me/activity`: the study days of a month with reviews, from every deck the Learner has studied. */
export const activity = (month: string | undefined) =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* InsightRepo
    const calendar = yield* learnerCalendar(learnerId)
    const target = month ?? calendar.today.slice(0, 7)
    const reviewed = yield* repo.reviewDays({ learnerId, deckId: null }, clockOf(calendar), calendar.today)

    return {
      month: target,
      days: reviewed
        .filter((day) => day.date.startsWith(`${target}-`))
        .map((day) => ({ date: day.date, reviews: day.count }))
    }
  })
