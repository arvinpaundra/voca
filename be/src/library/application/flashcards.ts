import { Effect, Random } from "effect"
import { CurrentLearner } from "@voca/contract"
import type { SessionSize, Word } from "@voca/contract"
import type { DeckNotFound } from "../domain/errors.ts"
import { WordRepo } from "./wordRepo.ts"
import { findOwnedDeckId } from "./words.ts"

type Needs = CurrentLearner | WordRepo

/** `size` of the deck's live words, or all of them, in a fresh random order. Writes nothing. */
export const flashcards = (
  deckSlug: string,
  size: SessionSize | undefined
): Effect.Effect<ReadonlyArray<Word>, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const words = yield* WordRepo
    const deckId = yield* findOwnedDeckId(id, deckSlug)
    const live = yield* words.liveWords(deckId)

    // Shuffled with the Random service, so a test can seed the order.
    const shuffled = yield* Random.shuffle(live)

    return size === undefined ? shuffled : shuffled.slice(0, size)
  })
