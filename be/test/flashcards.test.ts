import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import type { SessionSize } from "@voca/contract"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// Flashcards read a deck's words in a fresh random order and write nothing: no session, no review, no card change.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T10:00:00Z"))))

const flashcards = (token: string, deckSlug: string, size?: SessionSize) =>
  call(
    (c) =>
      c.library.flashcards({
        params: { deckSlug: deckSlug as never },
        query: size === undefined ? {} : { size }
      }),
    token
  )

describe("GET /decks/:deckSlug/flashcards", () => {
  test.each([
    [7, 12, 7],
    [10, 12, 10],
    [15, 12, 12],
    [20, 3, 3],
    [undefined, 12, 12]
  ] as const)("size %p of a %p-word deck gives %p distinct words of the deck", (size, words, expected) =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(words))

        const cards = yield* flashcards(token, deck.deckSlug, size)

        const slugs = cards.map((card) => String(card.slug))
        expect(slugs).toHaveLength(expected)
        expect(new Set(slugs).size).toBe(expected)
        expect(slugs.every((slug) => deck.words.some((word) => word.slug === slug))).toBe(true)
      })
    ))

  test("each card carries the word's term, reading, meaning, example and notes", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, [{ term: "食べる", reading: "たべる", meaning: "to eat" }])
        yield* sql`UPDATE words SET example = '朝ごはんを食べる', notes = 'ichidan' WHERE id = ${deck.words[0]!.id}`

        const [card] = yield* flashcards(token, deck.deckSlug)

        expect(card).toMatchObject({
          slug: deck.words[0]!.slug,
          term: "食べる",
          reading: "たべる",
          meaning: "to eat",
          example: "朝ごはんを食べる",
          notes: "ichidan"
        })
      })
    ))

  test("runs come in different orders", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(8))

        const orders = new Set<string>()

        for (let run = 0; run < 6; run++) {
          const cards = yield* flashcards(token, deck.deckSlug)
          orders.add(cards.map((card) => card.slug).join())
        }

        expect(orders.size).toBeGreaterThan(1)
      })
    ))

  test("deleted words are left out", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))
        const gone = deck.words[0]!
        yield* sql`UPDATE words SET deleted_at = '2026-11-02T00:00:00Z' WHERE id = ${gone.id}`

        const cards = yield* flashcards(token, deck.deckSlug)

        expect(cards).toHaveLength(3)
        expect(cards.some((card) => card.slug === gone.slug)).toBe(false)
      })
    ))

  test("an empty deck gives no cards", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, [])

        expect(yield* flashcards(token, deck.deckSlug, 7)).toEqual([])
      })
    ))

  test("another Learner's deck is not found", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token } = yield* signedIn("AAAAAAA1")
        const other = yield* signedIn("AAAAAAA2")
        const theirs = yield* seedDeck(other.id, wordList(4))

        const error = yield* flashcards(token, theirs.deckSlug).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))

  test("a run writes nothing: cards, reviews and sessions are unchanged", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(5))
        yield* seedCard(id, deck.words[0]!.id, "term_meaning", { due: "2026-11-13T04:00:00Z", stability: 4.5, difficulty: 6.25 })

        const snapshot = () =>
          Effect.all({
            cards: sql`SELECT word_id::text, drill, due, stability, difficulty, reps, lapses FROM cards ORDER BY id`,
            reviews: sql`SELECT count(*)::int AS n FROM reviews`,
            sessions: sql`SELECT count(*)::int AS n FROM study_sessions`,
            questions: sql`SELECT count(*)::int AS n FROM session_questions`
          })
        const before = yield* snapshot()

        yield* flashcards(token, deck.deckSlug, 7)
        yield* flashcards(token, deck.deckSlug)

        expect(yield* snapshot()).toEqual(before)
      })
    ))
})
