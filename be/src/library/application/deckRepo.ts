import type { Effect, Option } from "effect"
import { Context } from "effect"
import type { Deck, DeckSummary, UpdateDeck } from "@voca/contract"

/** A deck the Learner owns, with its internal id for later calls. */
export interface OwnedDeck {
  readonly id: bigint
  readonly deck: Deck
}

/** A deck to insert: the slug, trimmed text and clock time are already decided. */
export interface NewDeck {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly termLang: string
  readonly meaningLang: string
  readonly createdAt: number
}

/** Decks, always scoped to their owner. Deleted decks are invisible. Infrastructure failures are defects. */
export class DeckRepo extends Context.Service<DeckRepo, {
  /** The owner's live decks, newest first; counts are taken at `now` (epoch millis). */
  listOwned(learnerId: bigint, now: number): Effect.Effect<ReadonlyArray<DeckSummary>>
  findOwned(learnerId: bigint, slug: string): Effect.Effect<Option.Option<OwnedDeck>>
  insert(learnerId: bigint, deck: NewDeck): Effect.Effect<Deck>
  /** Changes only the fields `patch` sends, and sets `updatedAt` (epoch millis). */
  update(deckId: bigint, patch: typeof UpdateDeck.Type, updatedAt: number): Effect.Effect<Deck>
  hasWords(deckId: bigint): Effect.Effect<boolean>
  softDelete(deckId: bigint, at: number): Effect.Effect<void>
}>()("voca/library/DeckRepo") {}
