import type { Effect, Option } from "effect"
import { Context } from "effect"
import type { Word, WordWithCards } from "@voca/contract"

export interface WordPage {
  readonly items: ReadonlyArray<WordWithCards>
  readonly nextCursor: string | null
}

/** A word the Learner owns, with its internal ids for later calls. */
export interface OwnedWord {
  readonly id: bigint
  readonly deckId: bigint
  readonly word: Word
}

/** A word to insert: text already stored as NFC, keys computed, clock time taken. */
export interface NewWord {
  readonly slug: string
  readonly term: string
  readonly termKey: string
  readonly reading: string | null
  readonly readingKey: string
  readonly meaning: string
  readonly meaningKey: string
  readonly example: string | null
  readonly notes: string | null
  readonly createdAt: number
}

/** The fields a word edit changes; an absent field is unchanged, `null` clears an optional one. */
export interface WordChanges {
  term?: string
  termKey?: string
  meaning?: string
  meaningKey?: string
  reading?: string | null
  readingKey?: string
  example?: string | null
  notes?: string | null
}

/** `q` is already normalized; `limit` is the page size, without the one extra row used to find the next cursor. */
export interface WordQuery {
  readonly q: string | null
  readonly cursor: string | null
  readonly limit: number
}

/** Words, always scoped to the deck owner. Deleted words are invisible. Infrastructure failures are defects. */
export class WordRepo extends Context.Service<WordRepo, {
  /** The id of a deck the Learner owns, for the word use cases. */
  findOwnedDeckId(learnerId: bigint, deckSlug: string): Effect.Effect<Option.Option<bigint>>
  findOwned(learnerId: bigint, wordSlug: string): Effect.Effect<Option.Option<OwnedWord>>
  /** The Learner's cards ride along on each word. */
  list(learnerId: bigint, deckId: bigint, query: WordQuery): Effect.Effect<WordPage>
  /** None when the deck already holds a live word with the same keys. */
  insert(deckId: bigint, word: NewWord): Effect.Effect<Option.Option<Word>>
  /** None when the change would duplicate another live word in the deck. */
  update(wordId: bigint, changes: WordChanges): Effect.Effect<Option.Option<Word>>
  /** Soft-deletes the word and its cards. */
  softDelete(wordId: bigint, at: number): Effect.Effect<void>
  /** Soft-deletes every live word of the deck and their cards. */
  softDeleteInDeck(deckId: bigint, at: number): Effect.Effect<void>
}>()("voca/library/WordRepo") {}
