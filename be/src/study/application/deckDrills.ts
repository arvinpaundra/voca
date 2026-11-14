import { DateTime, Effect } from "effect"
import { CurrentLearner, drillLabel, type DeckDrill } from "@voca/contract"
import type { DeckNotFound } from "../domain/errors.ts"
import { studyDay } from "../domain/studyDay.ts"
import { cardKey } from "../domain/selection.ts"
import { DRILL_ORDER, appliesTo } from "../domain/words.ts"
import { StudyRepo } from "./studyRepo.ts"
import { dueIndexOf, findOwnedDeck } from "./lookups.ts"

/** The drills that apply to at least one word of the deck, each with today's due and new counts. */
export const deckDrills = (
  deckSlug: string
): Effect.Effect<ReadonlyArray<DeckDrill>, DeckNotFound, CurrentLearner | StudyRepo> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* StudyRepo
    const deck = yield* findOwnedDeck(learnerId, deckSlug)
    const settings = yield* repo.learnerSettings(learnerId)
    const day = studyDay(yield* DateTime.now, settings.timezone, settings.dayStartHour)
    const words = yield* repo.deckWords(deck.id)
    const dueAt = dueIndexOf(yield* repo.deckCards(learnerId, deck.id))
    const newToday = yield* repo.newReviewsBetween(learnerId, day.start, day.end)
    const newLeft = Math.max(0, settings.newPerDay - newToday)
    const dueBefore = DateTime.toEpochMillis(day.end)

    return DRILL_ORDER.flatMap((drill) => {
      const applicable = words.filter((word) => appliesTo(drill, word))

      if (applicable.length === 0) {
        return []
      }

      const withoutCard = applicable.filter((word) => !dueAt.has(cardKey(word.id, drill)))
      const due = applicable.filter((word) => {
        const at = dueAt.get(cardKey(word.id, drill))

        return at !== undefined && at < dueBefore
      })

      return [
        {
          drill,
          label: drillLabel(deck.termLang, drill),
          due: due.length,
          new: Math.min(withoutCard.length, newLeft)
        }
      ]
    })
  })
