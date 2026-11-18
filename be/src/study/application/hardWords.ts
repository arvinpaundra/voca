import { Effect } from "effect"
import { CurrentLearner } from "@voca/contract"
import type { Drill } from "@voca/contract"
import { CardNotFound } from "../domain/errors.ts"
import { StudyRepo, type HardWordPage } from "./studyRepo.ts"

type Needs = CurrentLearner | StudyRepo

const DEFAULT_PAGE_SIZE = 50

/** The Learner's hard words across decks, optionally those hard in one drill. */
export const listHardWords = (query: {
  readonly drill?: Drill
  readonly cursor?: string
  readonly limit?: number
}): Effect.Effect<HardWordPage, never, Needs> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* StudyRepo

    return yield* repo.hardWords(learnerId, {
      drill: query.drill ?? null,
      cursor: query.cursor ?? null,
      limit: query.limit ?? DEFAULT_PAGE_SIZE
    })
  })

/** Sets the hard flag of the Learner's card for the word and drill. NotFound when that card doesn't exist. */
const setHard = (wordSlug: string, drill: Drill, isHard: boolean): Effect.Effect<void, CardNotFound, Needs> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* StudyRepo
    const updated = yield* repo.setHard(learnerId, wordSlug, drill, isHard)

    if (!updated) {
      return yield* Effect.fail(new CardNotFound())
    }
  })

export const markHard = (wordSlug: string, drill: Drill) => setHard(wordSlug, drill, true)

export const unmarkHard = (wordSlug: string, drill: Drill) => setHard(wordSlug, drill, false)
