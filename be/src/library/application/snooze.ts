import { Effect } from "effect"
import type { CurrentLearner, Deck, SnoozeDecks, UnsnoozeDecks } from "@voca/contract"
import type { DeckNotFound } from "../domain/errors.ts"
import type { Transaction } from "../../shared/transaction.ts"
import type { DeckRepo } from "./deckRepo.ts"

type Needs = CurrentLearner | DeckRepo | Transaction

/** Snoozes the Learner's decks, all or none; a timed snooze ends at the Learner's day start on its end date. */
export const snoozeDecks = (
  _input: typeof SnoozeDecks.Type
): Effect.Effect<ReadonlyArray<Deck>, DeckNotFound, Needs> => Effect.die("not implemented: BL")

/** Ends the snooze of the Learner's decks, all or none. */
export const unsnoozeDecks = (
  _input: typeof UnsnoozeDecks.Type
): Effect.Effect<ReadonlyArray<Deck>, DeckNotFound, Needs> => Effect.die("not implemented: BL")
