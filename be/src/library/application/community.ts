import { Clock, Effect, Option } from "effect"
import { CurrentLearner, PREVIEW_WORDS, SLUG_LENGTH } from "@voca/contract"
import type { Deck, PublicDeckDetail } from "@voca/contract"
import { DeckNotFound, DeckNotPublic } from "../domain/errors.ts"
import { newSlug } from "../domain/slug.ts"
import { normalizeKey } from "../domain/text.ts"
import { Transaction } from "../../shared/transaction.ts"
import { DeckRepo } from "./deckRepo.ts"
import type { PublicDeckPage } from "./deckRepo.ts"
import { WordRepo } from "./wordRepo.ts"

const DEFAULT_PAGE_SIZE = 50

/** The public deck with the slug, or `DeckNotFound`: private and deleted decks look the same. */
const findPublicDeck = (deckSlug: string) =>
  Effect.gen(function* () {
    const decks = yield* DeckRepo
    const found = yield* decks.findPublic(deckSlug)

    return yield* Option.match(found, {
      onNone: () => Effect.fail(new DeckNotFound()),
      onSome: Effect.succeed
    })
  })

export const listPublicDecks = (query: {
  readonly q?: string
  readonly termLang?: string
  readonly sort?: "new" | "forks"
  readonly cursor?: string
  readonly limit?: number
}): Effect.Effect<PublicDeckPage, never, DeckRepo> =>
  Effect.gen(function* () {
    const decks = yield* DeckRepo

    return yield* decks.listPublic({
      q: query.q === undefined ? null : normalizeKey(query.q),
      termLang: query.termLang ?? null,
      sort: query.sort ?? "new",
      cursor: query.cursor ?? null,
      limit: query.limit ?? DEFAULT_PAGE_SIZE
    })
  })

export const getPublicDeck = (
  deckSlug: string
): Effect.Effect<PublicDeckDetail, DeckNotFound, DeckRepo | WordRepo> =>
  Effect.gen(function* () {
    const words = yield* WordRepo
    const publicDeck = yield* findPublicDeck(deckSlug)
    const preview = yield* words.preview(publicDeck.id, PREVIEW_WORDS)

    return { ...publicDeck.deck, preview }
  })

/**
 * Copies a public deck and its live words into a new private deck of the caller, with no cards. The copy and the
 * source's fork count move together, in one transaction.
 */
export const forkDeck = (
  deckSlug: string
): Effect.Effect<Deck, DeckNotFound | DeckNotPublic, CurrentLearner | DeckRepo | WordRepo | Transaction> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const decks = yield* DeckRepo
    const words = yield* WordRepo
    const transaction = yield* Transaction
    const found = yield* decks.findLive(deckSlug)
    const source = yield* Option.match(found, {
      onNone: () => Effect.fail(new DeckNotFound()),
      onSome: Effect.succeed
    })

    if (source.visibility !== "public") {
      return yield* Effect.fail(new DeckNotPublic())
    }

    const createdAt = yield* Clock.currentTimeMillis
    const slug = yield* newSlug(SLUG_LENGTH.deck)

    return yield* transaction.run(
      Effect.gen(function* () {
        const copy = yield* decks.insert(id, {
          slug,
          title: source.title,
          description: source.description,
          termLang: source.termLang,
          meaningLang: source.meaningLang,
          createdAt,
          forkedFromId: source.id
        })
        const liveWords = yield* words.listLive(source.id)
        const copies = yield* Effect.forEach(liveWords, (word) =>
          Effect.map(newSlug(SLUG_LENGTH.word), (wordSlug) => ({ ...word, slug: wordSlug, createdAt }))
        )

        yield* words.insertMany(copy.id, copies)
        yield* decks.incrementForkCount(source.id)

        return copy.deck
      })
    )
  })
