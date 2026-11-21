import { Clock, Effect, Option } from "effect"
import { CurrentLearner, SLUG_LENGTH } from "@voca/contract"
import type { CreateDeck, Deck, DeckDetail, DeckSummary, UpdateDeck } from "@voca/contract"
import { DeckNotFound, TermLangLocked } from "../domain/errors.ts"
import { newSlug } from "../domain/slug.ts"
import { Transaction } from "../../shared/transaction.ts"
import { DeckRepo } from "./deckRepo.ts"
import { WordRepo } from "./wordRepo.ts"

type Needs = CurrentLearner | DeckRepo | WordRepo | Transaction

/** The Learner's own deck, or `DeckNotFound`: another Learner's deck looks the same as a missing one. */
export const findOwnedDeck = (learnerId: bigint, slug: string, now: number) =>
  Effect.gen(function* () {
    const decks = yield* DeckRepo
    const found = yield* decks.findOwned(learnerId, slug, now)

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

    const created = yield* decks.insert(id, {
      slug,
      title: input.title,
      description: input.description ?? "",
      termLang: input.termLang,
      meaningLang: input.meaningLang,
      createdAt,
      forkedFromId: null
    })

    return created.deck
  })

/** Publishing puts the deck in the community now; it stays in the owner's library either way. */
export const publishDeck = (slug: string): Effect.Effect<Deck, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const at = yield* Clock.currentTimeMillis
    const owned = yield* findOwnedDeck(id, slug, at)

    return yield* decks.publish(owned.id, at)
  })

export const unpublishDeck = (slug: string): Effect.Effect<Deck, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const at = yield* Clock.currentTimeMillis
    const owned = yield* findOwnedDeck(id, slug, at)

    return yield* decks.unpublish(owned.id, at)
  })

/** The deck with its counts, taken now: the same numbers the decks list shows for it. */
export const getDeck = (slug: string): Effect.Effect<DeckDetail, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const now = yield* Clock.currentTimeMillis
    const owned = yield* findOwnedDeck(id, slug, now)
    const counts = yield* decks.counts(owned.id, id, now)

    return { ...owned.deck, ...counts }
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
    const updatedAt = yield* Clock.currentTimeMillis
    const owned = yield* findOwnedDeck(id, slug, updatedAt)
    const changesTermLang = patch.termLang !== undefined && patch.termLang !== owned.deck.termLang

    if (changesTermLang && (yield* decks.hasWords(owned.id))) {
      return yield* Effect.fail(new TermLangLocked())
    }

    return yield* decks.update(owned.id, patch, updatedAt)
  })

/** Soft-deletes the deck with its words and their cards, in one transaction. */
export const deleteDeck = (slug: string): Effect.Effect<void, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const words = yield* WordRepo
    const transaction = yield* Transaction
    const at = yield* Clock.currentTimeMillis
    const owned = yield* findOwnedDeck(id, slug, at)

    yield* transaction.run(
      Effect.gen(function* () {
        yield* words.softDeleteInDeck(owned.id, at)
        yield* decks.softDelete(owned.id, at)
      })
    )
  })
