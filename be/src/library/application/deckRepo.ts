import type { Effect, Option } from "effect"
import { Context } from "effect"
import type { CreateDeck, Deck, DeckSummary, UpdateDeck } from "@voca/contract"

/** A deck the Learner owns, with its internal id for later calls. */
export interface OwnedDeck {
  readonly id: bigint
  readonly deck: Deck
}

/** Decks, always scoped to their owner. Deleted decks are invisible. Infrastructure failures are defects. Task LB may reshape it. */
export class DeckRepo extends Context.Service<DeckRepo, {
  listOwned(learnerId: bigint): Effect.Effect<ReadonlyArray<DeckSummary>>
  findOwned(learnerId: bigint, slug: string): Effect.Effect<Option.Option<OwnedDeck>>
  insert(learnerId: bigint, input: typeof CreateDeck.Type): Effect.Effect<Deck>
  update(deckId: bigint, patch: typeof UpdateDeck.Type): Effect.Effect<Deck>
  hasWords(deckId: bigint): Effect.Effect<boolean>
  softDelete(deckId: bigint): Effect.Effect<void>
}>()("voca/library/DeckRepo") {}
