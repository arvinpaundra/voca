import type { Effect, Option } from "effect"
import { Context } from "effect"
import type { CreateWord, UpdateWord, Word, WordWithCards } from "@voca/contract"

export interface WordPage {
  readonly items: ReadonlyArray<WordWithCards>
  readonly nextCursor: string | null
}

/** Words, always scoped to the deck owner. Deleted words are invisible. Infrastructure failures are defects. Task LW may reshape it. */
export class WordRepo extends Context.Service<WordRepo, {
  /** The id of a deck the Learner owns, for the word use cases. */
  findOwnedDeckId(learnerId: bigint, deckSlug: string): Effect.Effect<Option.Option<bigint>>
  findOwned(learnerId: bigint, wordSlug: string): Effect.Effect<Option.Option<{ readonly id: bigint; readonly deckId: bigint; readonly word: Word }>>
  list(deckId: bigint, query: { readonly q?: string; readonly cursor?: string; readonly limit: number }): Effect.Effect<WordPage>
  /** None when the deck already holds a word with the same keys. */
  insert(deckId: bigint, input: typeof CreateWord.Type): Effect.Effect<Option.Option<Word>>
  /** None when the change would duplicate another word in the deck. */
  update(wordId: bigint, patch: typeof UpdateWord.Type): Effect.Effect<Option.Option<Word>>
  softDelete(wordId: bigint): Effect.Effect<void>
}>()("voca/library/WordRepo") {}
