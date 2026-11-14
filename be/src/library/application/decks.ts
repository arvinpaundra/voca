import { Effect } from "effect"
import type { CreateDeck, CurrentLearner, Deck, DeckSummary, UpdateDeck } from "@voca/contract"
import type { DeckNotFound, TermLangLocked } from "../domain/errors.ts"
import type { DeckRepo } from "./deckRepo.ts"

// Deck use cases, scoped to the signed-in Learner. Not implemented yet: task LD.

type Needs = CurrentLearner | DeckRepo

export const listDecks: Effect.Effect<ReadonlyArray<DeckSummary>, never, Needs> = Effect.die("not implemented")

export const createDeck = (_input: typeof CreateDeck.Type): Effect.Effect<Deck, never, Needs> =>
  Effect.die("not implemented")

export const getDeck = (_slug: string): Effect.Effect<Deck, DeckNotFound, Needs> =>
  Effect.die("not implemented")

export const updateDeck = (
  _slug: string,
  _patch: typeof UpdateDeck.Type
): Effect.Effect<Deck, DeckNotFound | TermLangLocked, Needs> =>
  Effect.die("not implemented")

export const deleteDeck = (_slug: string): Effect.Effect<void, DeckNotFound, Needs> =>
  Effect.die("not implemented")
