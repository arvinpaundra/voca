import { Clock, DateTime, Effect } from "effect"
import { CurrentLearner } from "@voca/contract"
import type { Deck, SnoozeDecks, UnsnoozeDecks } from "@voca/contract"
import { dueAfter, studyDay } from "../../study/domain/studyDay.ts"
import type { DeckNotFound } from "../domain/errors.ts"
import { Transaction } from "../../shared/transaction.ts"
import { DeckRepo } from "./deckRepo.ts"
import type { StudyClock } from "./deckRepo.ts"
import { findOwnedDeck } from "./decks.ts"

type Needs = CurrentLearner | DeckRepo | Transaction

/**
 * When a snooze of `days` study days ends, in epoch millis: the Learner's day start on the study date `days` after
 * today. `null` lasts until unsnoozed.
 */
const snoozeEnd = (now: number, days: number | null, clock: StudyClock): number | null => {
  if (days === null) {
    return null
  }

  const day = studyDay(DateTime.makeUnsafe(now), clock.timezone, clock.dayStartHour)

  return DateTime.toEpochMillis(dueAfter(day, clock.timezone, clock.dayStartHour, days))
}

/** Snoozes the Learner's decks, all or none; a timed snooze ends at the Learner's day start on its end date. */
export const snoozeDecks = (
  input: typeof SnoozeDecks.Type
): Effect.Effect<ReadonlyArray<Deck>, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const transaction = yield* Transaction
    const now = yield* Clock.currentTimeMillis
    const clock = yield* decks.studyClock(id)
    const until = snoozeEnd(now, input.days, clock)

    // Every slug is resolved before anything is written: one deck that isn't the Learner's fails the whole batch.
    const owned = yield* Effect.forEach(input.deckSlugs, (slug) => findOwnedDeck(id, slug, now))

    return yield* transaction.run(
      Effect.forEach(owned, (deck) => decks.snooze(deck.id, now, until))
    )
  })

/** Ends the snooze of the Learner's decks, all or none. */
export const unsnoozeDecks = (
  input: typeof UnsnoozeDecks.Type
): Effect.Effect<ReadonlyArray<Deck>, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const transaction = yield* Transaction
    const now = yield* Clock.currentTimeMillis

    const owned = yield* Effect.forEach(input.deckSlugs, (slug) => findOwnedDeck(id, slug, now))

    return yield* transaction.run(
      Effect.forEach(owned, (deck) => decks.unsnooze(deck.id, now))
    )
  })
