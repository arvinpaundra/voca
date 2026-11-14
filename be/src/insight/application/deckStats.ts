import { Effect, Option } from "effect"
import { CurrentLearner } from "@voca/contract"
import { learnerCalendar } from "./calendar.ts"
import { DeckNotFound } from "./errors.ts"
import { InsightRepo } from "./insightRepo.ts"
import { scopeStats } from "./scopeStats.ts"

/** `GET /decks/:deckSlug/stats`: the Learner's live deck, or `DeckNotFound`. */
export const deckStats = (deckSlug: string) =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* InsightRepo
    const found = yield* repo.findLiveDeck(learnerId, deckSlug)
    const deckId = yield* Option.match(found, {
      onNone: () => Effect.fail(new DeckNotFound()),
      onSome: Effect.succeed
    })
    const calendar = yield* learnerCalendar(learnerId)

    return yield* scopeStats({ learnerId, deckId }, calendar)
  })
