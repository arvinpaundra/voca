import { DateTime, Effect } from "effect"
import { CurrentLearner, type DeckSetup } from "@voca/contract"
import type { DeckNotFound } from "../domain/errors.ts"
import { studyDay } from "../domain/studyDay.ts"
import { StudyRepo } from "./studyRepo.ts"
import { deckDrills } from "./deckDrills.ts"

export const deckSetup = (
  deckSlug: string
): Effect.Effect<DeckSetup, DeckNotFound, CurrentLearner | StudyRepo> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* StudyRepo
    const drills = yield* deckDrills(deckSlug)
    const settings = yield* repo.learnerSettings(learnerId)
    const day = studyDay(yield* DateTime.now, settings.timezone, settings.dayStartHour)
    const studied = yield* repo.newReviewsBetween(learnerId, day.start, day.end)

    return {
      drills,
      newCards: { studied, target: settings.newPerDay }
    } satisfies DeckSetup
  })
