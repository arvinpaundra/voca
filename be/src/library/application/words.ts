import { Effect } from "effect"
import type { CreateWord, CurrentLearner, UpdateWord, Word } from "@voca/contract"
import type { DeckNotFound, DuplicateWordError, WordNotFound } from "../domain/errors.ts"
import type { WordPage, WordRepo } from "./wordRepo.ts"

// Word use cases, scoped to the deck owner. Not implemented yet: task LW.

type Needs = CurrentLearner | WordRepo

export const listWords = (
  _deckSlug: string,
  _query: { readonly q?: string; readonly cursor?: string; readonly limit?: number }
): Effect.Effect<WordPage, DeckNotFound, Needs> =>
  Effect.die("not implemented")

export const createWord = (
  _deckSlug: string,
  _input: typeof CreateWord.Type
): Effect.Effect<Word, DeckNotFound | DuplicateWordError, Needs> =>
  Effect.die("not implemented")

export const updateWord = (
  _wordSlug: string,
  _patch: typeof UpdateWord.Type
): Effect.Effect<Word, WordNotFound | DuplicateWordError, Needs> =>
  Effect.die("not implemented")

export const deleteWord = (_wordSlug: string): Effect.Effect<void, WordNotFound, Needs> =>
  Effect.die("not implemented")
