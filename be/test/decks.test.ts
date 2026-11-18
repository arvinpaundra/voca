import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { DateTime, Effect } from "effect"
import { SqlClient } from "effect/sql"
import { TestClock } from "effect/testing"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// Decks: create, list (own only, newest first, with word and due counts), get, update, soft delete.
// Another Learner's deck answers 404, exactly like a deck that doesn't exist.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

/** Seeds a Learner and returns an access token for them. */
const signedIn = (slug: string) =>
  Effect.gen(function* () {
    yield* seedLearner(slug)
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

const newDeck = (token: string, title = "N5 Verbs") =>
  call((c) => c.library.createDeck({ payload: { title, termLang: "ja", meaningLang: "en" } }), token)

/** Words and cards are seeded with SQL, so these tests never depend on the word endpoints. */
const seedWord = (deckSlug: string, term: string, opts: { deleted?: boolean } = {}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const [row] = yield* sql<{ readonly id: string }>`
      INSERT INTO words (slug, deck_id, term, reading, meaning, example, notes, term_key, reading_key, meaning_key, created_at, deleted_at)
      SELECT ${("W" + term).padEnd(12, "0").slice(0, 12)}, id, ${term}, NULL, 'meaning', NULL, NULL, ${term}, '', 'meaning',
             now(), ${opts.deleted ? new Date() : null}
      FROM decks WHERE slug = ${deckSlug}
      RETURNING id::text AS id`
    return BigInt(row!.id)
  })

const seedCard = (wordId: bigint, learnerSlug: string, due: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      INSERT INTO cards (word_id, drill, learner_id, stability, difficulty, due, last_review, reps, lapses, is_hard)
      SELECT ${wordId}, 'term_meaning', id, 3, 5, ${new Date(due)}, now(), 1, 0, false
      FROM learners WHERE slug = ${learnerSlug}`
  })

const deletedAt = (table: "decks" | "words" | "cards") =>
  SqlClient.SqlClient.pipe(
    Effect.flatMap((sql) => sql<{ readonly deleted: boolean }>`SELECT deleted_at IS NOT NULL AS deleted FROM ${sql(table)}`),
    Effect.map((rows) => rows.map((r) => r.deleted))
  )

describe("POST /decks", () => {
  test("creates a private deck owned by the caller", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")

        const deck = yield* call(
          (c) => c.library.createDeck({ payload: { title: "  N5 Verbs  ", termLang: "ja", meaningLang: "en" } }),
          token
        )

        expect(String(deck.slug)).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/)
        expect(deck).toMatchObject({
          title: "N5 Verbs",
          description: "",
          termLang: "ja",
          meaningLang: "en",
          visibility: "private",
          publishedAt: null,
          forkedFrom: null,
          forkCount: 0
        })
        expect(DateTime.formatIso(deck.createdAt)).toBe("2026-11-14T00:00:00.000Z")
        expect(DateTime.formatIso(deck.updatedAt)).toBe("2026-11-14T00:00:00.000Z")
      })
    ))
})

describe("GET /decks", () => {
  test("lists only the caller's decks, newest first", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")

        yield* newDeck(ada, "First")
        yield* TestClock.adjust("1 minute")
        yield* newDeck(ada, "Second")
        yield* newDeck(bob, "Bob's")

        const decks = yield* call((c) => c.library.listDecks(), ada)

        expect(decks.map((d) => d.title)).toEqual(["Second", "First"])
      })
    ))

  test("counts live words, and cards due now", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const deck = yield* newDeck(token)

        const due = yield* seedWord(deck.slug, "食べる")
        const later = yield* seedWord(deck.slug, "飲む")
        yield* seedWord(deck.slug, "見る")
        const gone = yield* seedWord(deck.slug, "行く", { deleted: true })

        yield* seedCard(due, "ABCDEFGH", "2026-11-13T00:00:00Z")
        yield* seedCard(later, "ABCDEFGH", "2026-11-20T00:00:00Z")
        yield* seedCard(gone, "ABCDEFGH", "2026-11-01T00:00:00Z")

        const [summary] = yield* call((c) => c.library.listDecks(), token)

        expect(summary).toMatchObject({ wordCount: 3, dueCount: 1 })
      })
    ))
})

describe("GET /decks/:deckSlug", () => {
  test("returns the caller's deck", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const created = yield* newDeck(token)

        const deck = yield* call((c) => c.library.getDeck({ params: { deckSlug: created.slug } }), token)

        expect(deck).toMatchObject(created)
      })
    ))

  test("another Learner's deck and an unknown slug both answer 404", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")
        const adas = yield* newDeck(ada)

        const theirs = yield* call((c) => c.library.getDeck({ params: { deckSlug: adas.slug } }), bob).pipe(Effect.flip)
        const unknown = yield* call((c) => c.library.getDeck({ params: { deckSlug: "ZZZZZZZZZZ" as never } }), ada).pipe(
          Effect.flip
        )

        expect(theirs._tag).toBe("NotFound")
        expect(unknown._tag).toBe("NotFound")
      })
    ))
})

describe("PATCH /decks/:deckSlug", () => {
  test("changes only the fields sent, and bumps updatedAt", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const created = yield* newDeck(token)
        yield* TestClock.adjust("10 minutes")

        const deck = yield* call(
          (c) =>
            c.library.updateDeck({
              params: { deckSlug: created.slug },
              payload: { title: "JLPT N5 Verbs", description: "Group 1 and 2" }
            }),
          token
        )

        expect(deck).toMatchObject({ title: "JLPT N5 Verbs", description: "Group 1 and 2", termLang: "ja", meaningLang: "en" })
        expect(DateTime.formatIso(deck.createdAt)).toBe("2026-11-14T00:00:00.000Z")
        expect(DateTime.formatIso(deck.updatedAt)).toBe("2026-11-14T00:10:00.000Z")
      })
    ))

  test("the term language can change while the deck is empty, and not once it has words", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const created = yield* newDeck(token)
        const update = (termLang: string) =>
          call((c) => c.library.updateDeck({ params: { deckSlug: created.slug }, payload: { termLang } }), token)

        const changed = yield* update("zh-Hans")
        yield* seedWord(created.slug, "学习")
        const refused = yield* update("ja").pipe(Effect.flip)
        const meaningStillChanges = yield* call(
          (c) => c.library.updateDeck({ params: { deckSlug: created.slug }, payload: { meaningLang: "id" } }),
          token
        )

        expect(changed.termLang).toBe("zh-Hans")
        expect(refused._tag).toBe("Forbidden")
        expect(meaningStillChanges.meaningLang).toBe("id")
      })
    ))

  test("another Learner's deck answers 404", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")
        const adas = yield* newDeck(ada)

        const error = yield* call(
          (c) => c.library.updateDeck({ params: { deckSlug: adas.slug }, payload: { title: "Mine now" } }),
          bob
        ).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))
})

describe("DELETE /decks/:deckSlug", () => {
  test("soft-deletes the deck with its words and cards; it is gone everywhere", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const deck = yield* newDeck(token)
        const word = yield* seedWord(deck.slug, "食べる")
        yield* seedCard(word, "ABCDEFGH", "2026-11-13T00:00:00Z")

        yield* call((c) => c.library.deleteDeck({ params: { deckSlug: deck.slug } }), token)

        const get = yield* call((c) => c.library.getDeck({ params: { deckSlug: deck.slug } }), token).pipe(Effect.flip)
        expect(get._tag).toBe("NotFound")
        expect(yield* call((c) => c.library.listDecks(), token)).toEqual([])
        expect(yield* deletedAt("decks")).toEqual([true])
        expect(yield* deletedAt("words")).toEqual([true])
        expect(yield* deletedAt("cards")).toEqual([true])
      })
    ))

  test("a published deck is unpublished as it is deleted, so an undelete can't republish it", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const deck = yield* newDeck(token)

        yield* call((c) => c.library.publishDeck({ params: { deckSlug: deck.slug } }), token)
        yield* call((c) => c.library.deleteDeck({ params: { deckSlug: deck.slug } }), token)

        const sql = yield* SqlClient.SqlClient
        const rows = yield* sql<{ readonly visibility: string; readonly published: boolean }>`
          SELECT visibility, published_at IS NOT NULL AS published FROM decks WHERE slug = ${String(deck.slug)}`

        expect(rows[0]).toEqual({ visibility: "private", published: false })
      })
    ))

  test("another Learner's deck answers 404 and stays", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")
        const adas = yield* newDeck(ada)

        const error = yield* call((c) => c.library.deleteDeck({ params: { deckSlug: adas.slug } }), bob).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
        expect(yield* deletedAt("decks")).toEqual([false])
      })
    ))
})
