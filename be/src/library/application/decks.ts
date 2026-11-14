import { Clock, Effect, Option } from "effect"
import { CurrentLearner, SLUG_LENGTH } from "@voca/contract"
import type { CreateDeck, Deck, DeckSummary, UpdateDeck } from "@voca/contract"
import { DeckNotFound, TermLangLocked } from "../domain/errors.ts"
import { newSlug } from "../domain/slug.ts"
import { Transaction } from "../../shared/transaction.ts"
import { DeckRepo } from "./deckRepo.ts"
import { WordRepo } from "./wordRepo.ts"

type Needs = CurrentLearner | DeckRepo | WordRepo | Transaction

/** The Learner's own deck, or `DeckNotFound`: another Learner's deck looks the same as a missing one. */
const findOwnedDeck = (learnerId: bigint, slug: string) =>
  Effect.gen(function* () {
    const decks = yield* DeckRepo
    const found = yield* decks.findOwned(learnerId, slug)

    return yield* Option.match(found, {
      onNone: () => Effect.fail(new DeckNotFound()),
      onSome: Effect.succeed
    })
  })

export const listDecks: Effect.Effect<ReadonlyArray<DeckSummary>, never, Needs> = Effect.gen(function* () {
  const { id } = yield* CurrentLearner
  const decks = yield* DeckRepo
  const now = yield* Clock.currentTimeMillis

  return yield* decks.listOwned(id, now)
})

export const createDeck = (input: typeof CreateDeck.Type): Effect.Effect<Deck, never, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const slug = yield* newSlug(SLUG_LENGTH.deck)
    const createdAt = yield* Clock.currentTimeMillis

    return yield* decks.insert(id, {
      slug,
      title: input.title,
      description: input.description ?? "",
      termLang: input.termLang,
      meaningLang: input.meaningLang,
      createdAt
    })
  })

export const getDeck = (slug: string): Effect.Effect<Deck, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const owned = yield* findOwnedDeck(id, slug)

    return owned.deck
  })

/**
 * The term language is locked once the deck has words; setting it to the value it already has is not a change.
 * Meaning language can always change.
 */
export const updateDeck = (
  slug: string,
  patch: typeof UpdateDeck.Type
): Effect.Effect<Deck, DeckNotFound | TermLangLocked, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const owned = yield* findOwnedDeck(id, slug)
    const changesTermLang = patch.termLang !== undefined && patch.termLang !== owned.deck.termLang

    if (changesTermLang && (yield* decks.hasWords(owned.id))) {
      return yield* Effect.fail(new TermLangLocked())
    }

    const updatedAt = yield* Clock.currentTimeMillis

    return yield* decks.update(owned.id, patch, updatedAt)
  })

/** Soft-deletes the deck with its words and their cards, in one transaction. */
export const deleteDeck = (slug: string): Effect.Effect<void, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const words = yield* WordRepo
    const transaction = yield* Transaction
    const owned = yield* findOwnedDeck(id, slug)
    const at = yield* Clock.currentTimeMillis

    yield* transaction.run(
      Effect.gen(function* () {
        yield* words.softDeleteInDeck(owned.id, at)
        yield* decks.softDelete(owned.id, at)
      })
    )
  })
