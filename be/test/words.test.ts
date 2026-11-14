import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { DateTime, Effect } from "effect"
import { SqlClient } from "effect/sql"
import { TestClock } from "effect/testing"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { normalizeKey } from "../src/library/domain/text.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// Words: add, list (paginated, searchable, with the Learner's cards), edit, soft delete.
// Text is stored as NFC; duplicates in a deck are found by an NFKC + case-folded key of term and reading.

describe("normalizeKey", () => {
  test.each([
    ["half-width katakana", "ｶﾀｶﾅ", "カタカナ"],
    ["case", "Apple", "apple"],
    ["full-width Latin", "ＡＢＣ", "abc"],
    ["surrounding whitespace", "  食べる ", "食べる"]
  ])("%s collide", (_, a, b) => {
    expect(normalizeKey(a)).toBe(normalizeKey(b))
  })

  test("different words don't", () => {
    expect(normalizeKey("箸")).not.toBe(normalizeKey("橋"))
    expect(normalizeKey("カタカナ")).not.toBe(normalizeKey("かたかな"))
  })
})

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const signedIn = (slug: string) =>
  Effect.gen(function* () {
    yield* seedLearner(slug)
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

const newDeck = (token: string) =>
  call((c) => c.library.createDeck({ payload: { title: "N5", termLang: "ja", meaningLang: "en" } }), token)

type NewWord = { term: string; meaning: string; reading?: string; example?: string; notes?: string }

const addWord = (token: string, deckSlug: string, word: NewWord) =>
  call((c) => c.library.createWord({ params: { deckSlug: deckSlug as never }, payload: word }), token)

const listWords = (token: string, deckSlug: string, query: { q?: string; cursor?: string; limit?: number } = {}) =>
  call((c) => c.library.listWords({ params: { deckSlug: deckSlug as never }, query }), token)

/** A deck owned by a fresh Learner, plus their token. */
const ownDeck = (slug = "ABCDEFGH") =>
  Effect.gen(function* () {
    const token = yield* signedIn(slug)
    const deck = yield* newDeck(token)
    return { token, deckSlug: String(deck.slug) }
  })

describe("POST /decks/:deckSlug/words", () => {
  test("adds a word, stored as NFC, with absent optional fields as null", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const decomposed = "cafe\u0301"

        const word = yield* addWord(token, deckSlug, { term: decomposed, meaning: "coffee shop" })

        expect(String(word.slug)).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/)
        expect(word).toMatchObject({ term: "café", meaning: "coffee shop", reading: null, example: null, notes: null })
        expect(word.term).toBe("café")
        expect(DateTime.formatIso(word.createdAt)).toBe("2026-11-14T00:00:00.000Z")
      })
    ))

  test.each([
    ["half-width katakana", { term: "カタカナ", meaning: "katakana" }, { term: "ｶﾀｶﾅ", meaning: "again" }],
    ["case and spaces", { term: "Apple", meaning: "fruit" }, { term: " apple ", meaning: "again" }],
    ["same term and reading", { term: "生", reading: "なま", meaning: "raw" }, { term: "生", reading: "なま", meaning: "fresh" }]
  ])("a duplicate (%s) answers 409 DuplicateWord", (_, first, second) =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        yield* addWord(token, deckSlug, first)

        const error = yield* addWord(token, deckSlug, second).pipe(Effect.flip)

        expect(error._tag).toBe("DuplicateWord")
      })
    ))

  test("the same term with another reading is a different word", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        yield* addWord(token, deckSlug, { term: "生", reading: "なま", meaning: "raw" })
        const other = yield* addWord(token, deckSlug, { term: "生", reading: "せい", meaning: "life" })

        expect(other.reading).toBe("せい")
      })
    ))

  test("another Learner's deck and an unknown deck answer 404", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* ownDeck("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")

        const theirs = yield* addWord(bob, ada.deckSlug, { term: "犬", meaning: "dog" }).pipe(Effect.flip)
        const unknown = yield* addWord(ada.token, "ZZZZZZZZZZ", { term: "犬", meaning: "dog" }).pipe(Effect.flip)

        expect(theirs._tag).toBe("NotFound")
        expect(unknown._tag).toBe("NotFound")
      })
    ))
})

describe("GET /decks/:deckSlug/words", () => {
  test("pages through the words in the order they were added", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        for (const term of ["一", "二", "三", "四", "五"]) {
          yield* addWord(token, deckSlug, { term, meaning: `number ${term}` })
          yield* TestClock.adjust("1 second")
        }

        const first = yield* listWords(token, deckSlug, { limit: 2 })
        const second = yield* listWords(token, deckSlug, { limit: 2, cursor: first.nextCursor! })
        const last = yield* listWords(token, deckSlug, { limit: 2, cursor: second.nextCursor! })

        expect(first.items.map((w) => w.term)).toEqual(["一", "二"])
        expect(second.items.map((w) => w.term)).toEqual(["三", "四"])
        expect(last.items.map((w) => w.term)).toEqual(["五"])
        expect(last.nextCursor).toBeNull()
      })
    ))

  test("q matches the term, the reading or the meaning, ignoring case and width", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        yield* addWord(token, deckSlug, { term: "食べる", reading: "たべる", meaning: "to eat" })
        yield* addWord(token, deckSlug, { term: "飲む", reading: "のむ", meaning: "to drink" })
        yield* addWord(token, deckSlug, { term: "Apple", meaning: "ringo" })

        const byReading = yield* listWords(token, deckSlug, { q: "たべ" })
        const byMeaning = yield* listWords(token, deckSlug, { q: "DRINK" })
        const byTerm = yield* listWords(token, deckSlug, { q: "ａｐｐ" })

        expect(byReading.items.map((w) => w.term)).toEqual(["食べる"])
        expect(byMeaning.items.map((w) => w.term)).toEqual(["飲む"])
        expect(byTerm.items.map((w) => w.term)).toEqual(["Apple"])
      })
    ))

  test("each word carries the caller's cards, and an empty list when it has none", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const studied = yield* addWord(token, deckSlug, { term: "食べる", meaning: "to eat" })
        yield* addWord(token, deckSlug, { term: "飲む", meaning: "to drink" })

        const sql = yield* SqlClient.SqlClient
        yield* sql`
          INSERT INTO cards (word_id, drill, learner_id, stability, difficulty, due, last_review, reps, lapses, is_hard)
          SELECT w.id, 'term_meaning', d.owner_id, 12.5, 5, '2026-11-20T00:00:00Z', now(), 3, 0, true
          FROM words w JOIN decks d ON d.id = w.deck_id WHERE w.slug = ${studied.slug}`

        const page = yield* listWords(token, deckSlug)

        const [eat, drink] = page.items
        expect(eat?.cards).toHaveLength(1)
        expect(eat?.cards[0]).toMatchObject({ drill: "term_meaning", stabilityDays: 12.5, isHard: true })
        expect(DateTime.formatIso(eat!.cards[0]!.due)).toBe("2026-11-20T00:00:00.000Z")
        expect(drink?.cards).toEqual([])
      })
    ))

  test("another Learner's deck answers 404", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* ownDeck("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")

        const error = yield* listWords(bob, ada.deckSlug).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))
})

describe("PATCH /words/:wordSlug", () => {
  test("changes only the fields sent; null clears an optional field", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const word = yield* addWord(token, deckSlug, { term: "食べる", reading: "たべる", meaning: "eat", notes: "ichidan" })

        const updated = yield* call(
          (c) => c.library.updateWord({ params: { wordSlug: word.slug }, payload: { meaning: "to eat", notes: null } }),
          token
        )

        expect(updated).toMatchObject({ term: "食べる", reading: "たべる", meaning: "to eat", notes: null })
      })
    ))

  test("an edit that would duplicate another word answers 409", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        yield* addWord(token, deckSlug, { term: "Apple", meaning: "fruit" })
        const other = yield* addWord(token, deckSlug, { term: "Pear", meaning: "fruit" })

        const error = yield* call(
          (c) => c.library.updateWord({ params: { wordSlug: other.slug }, payload: { term: "APPLE" } }),
          token
        ).pipe(Effect.flip)

        expect(error._tag).toBe("DuplicateWord")
      })
    ))

  test("another Learner's word answers 404", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* ownDeck("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")
        const word = yield* addWord(ada.token, ada.deckSlug, { term: "犬", meaning: "dog" })

        const error = yield* call(
          (c) => c.library.updateWord({ params: { wordSlug: word.slug }, payload: { meaning: "cat" } }),
          bob
        ).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))
})

describe("DELETE /words/:wordSlug", () => {
  test("soft-deletes the word; the same term can be added again", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const word = yield* addWord(token, deckSlug, { term: "犬", meaning: "dog" })

        yield* call((c) => c.library.deleteWord({ params: { wordSlug: word.slug } }), token)

        expect((yield* listWords(token, deckSlug)).items).toEqual([])
        const again = yield* addWord(token, deckSlug, { term: "犬", meaning: "dog" })
        expect(again.slug).not.toBe(word.slug)

        const sql = yield* SqlClient.SqlClient
        const rows = yield* sql<{ readonly n: string }>`SELECT count(*)::text AS n FROM words`
        expect(rows[0]?.n).toBe("2")
      })
    ))

  test("another Learner's word answers 404", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* ownDeck("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")
        const word = yield* addWord(ada.token, ada.deckSlug, { term: "犬", meaning: "dog" })

        const error = yield* call((c) => c.library.deleteWord({ params: { wordSlug: word.slug } }), bob).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))
})
