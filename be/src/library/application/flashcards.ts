import { Effect } from "effect"
import type { CurrentLearner, SessionSize, Word } from "@voca/contract"
import type { DeckNotFound } from "../domain/errors.ts"
import type { DeckRepo } from "./deckRepo.ts"
import type { WordRepo } from "./wordRepo.ts"

type Needs = CurrentLearner | DeckRepo | WordRepo

/** `size` of the deck's live words, or all of them, in a fresh random order. Writes nothing. */
export const flashcards = (
  _deckSlug: string,
  _size: SessionSize | undefined
): Effect.Effect<ReadonlyArray<Word>, DeckNotFound, Needs> => Effect.die("not implemented: BL")
