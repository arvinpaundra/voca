import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import type { Drill } from "@voca/contract"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// GET /hard-words pages the Learner's hard words and sums up the whole list in `summary`: how many words, how many
// have a hard card due now, and which drills have hard cards. The summary ignores `drill` and the page.
// The clock is 2026-11-14T00:00Z.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const DUE = "2026-11-13T12:00:00Z"
const LATER = "2026-11-25T00:00:00Z"

type Query = { drill?: Drill; cursor?: string; limit?: number }

const hardWords = (token: string, query: Query = {}) => call((c) => c.study.hardWords({ query }), token)

const snoozeDeck = (deckId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`UPDATE decks SET snoozed_at = '2026-11-14T00:00:00Z', snoozed_until = NULL WHERE id = ${deckId}`
  })

describe("GET /hard-words paging", () => {
  test("40 hard words come 15, 15 and 10 at a time in the same order, none twice", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const deck = yield* seedDeck(ada.id, wordList(40, "語"))

        for (const word of deck.words) {
          yield* seedCard(ada.id, word.id, "term_meaning", { due: DUE, hard: true })
        }

        const first = yield* hardWords(ada.token, { limit: 15 })
        const second = yield* hardWords(ada.token, { limit: 15, cursor: first.nextCursor! })
        const third = yield* hardWords(ada.token, { limit: 15, cursor: second.nextCursor! })

        expect([first, second, third].map((page) => page.items.length)).toEqual([15, 15, 10])
        expect(third.nextCursor).toBeNull()
        expect([first, second, third].flatMap((page) => page.items.map((item) => String(item.slug)))).toEqual(
          deck.words.map((word) => word.slug)
        )
      })
    ))

  test("the drill filter pages inside the words hard in that drill", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const deck = yield* seedDeck(ada.id, wordList(20, "語"))

        for (const [i, word] of deck.words.entries()) {
          yield* seedCard(ada.id, word.id, i % 2 === 0 ? "term_meaning" : "reading_term", { due: DUE, hard: true })
        }

        const first = yield* hardWords(ada.token, { drill: "reading_term", limit: 4 })
        const second = yield* hardWords(ada.token, { drill: "reading_term", limit: 4, cursor: first.nextCursor! })
        const third = yield* hardWords(ada.token, { drill: "reading_term", limit: 4, cursor: second.nextCursor! })

        expect([first, second, third].map((page) => page.items.length)).toEqual([4, 4, 2])
        expect([first, second, third].flatMap((page) => page.items.map((item) => item.term))).toEqual(
          deck.words.filter((_, i) => i % 2 === 1).map((word) => word.term)
        )
      })
    ))
})

describe("GET /hard-words summary", () => {
  test("is on every page and covers the whole list", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const deck = yield* seedDeck(ada.id, wordList(40, "語"))

        for (const [i, word] of deck.words.entries()) {
          yield* seedCard(ada.id, word.id, "term_meaning", { due: i < 25 ? DUE : LATER, hard: true })
        }

        const first = yield* hardWords(ada.token, { limit: 15 })
        const second = yield* hardWords(ada.token, { limit: 15, cursor: first.nextCursor! })

        for (const page of [first, second]) {
          expect(page.summary).toEqual({
            total: 40,
            dueToday: 25,
            drills: [{ drill: "term_meaning", count: 40, termLang: "ja" }]
          })
        }
      })
    ))

  test("ignores the drill filter", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const deck = yield* seedDeck(ada.id, wordList(4, "語"))

        yield* seedCard(ada.id, deck.words[0]!.id, "term_meaning", { due: DUE, hard: true })
        yield* seedCard(ada.id, deck.words[1]!.id, "term_meaning", { due: LATER, hard: true })
        yield* seedCard(ada.id, deck.words[2]!.id, "reading_term", { due: LATER, hard: true })

        const all = yield* hardWords(ada.token)
        const one = yield* hardWords(ada.token, { drill: "reading_term" })

        expect(one.items.length).toBe(1)
        expect(one.summary).toEqual(all.summary)
        expect(all.summary).toEqual({
          total: 3,
          dueToday: 1,
          drills: [
            { drill: "term_meaning", count: 2, termLang: "ja" },
            { drill: "reading_term", count: 1, termLang: "ja" }
          ]
        })
      })
    ))

  test("counts a word with hard cards in two drills once, and once in each drill", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const deck = yield* seedDeck(ada.id, wordList(2, "語"))
        const [both, one] = deck.words

        yield* seedCard(ada.id, both!.id, "term_meaning", { due: DUE, hard: true })
        yield* seedCard(ada.id, both!.id, "meaning_term", { due: DUE, hard: true })
        yield* seedCard(ada.id, one!.id, "meaning_term", { due: LATER, hard: true })

        const page = yield* hardWords(ada.token)

        expect(page.summary).toEqual({
          total: 2,
          dueToday: 1,
          drills: [
            { drill: "term_meaning", count: 1, termLang: "ja" },
            { drill: "meaning_term", count: 2, termLang: "ja" }
          ]
        })
      })
    ))

  test("a drill's termLang is the first word's in list order", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const verbs = yield* seedDeck(ada.id, wordList(2, "動"), { termLang: "ja" })
        const hanzi = yield* seedDeck(ada.id, wordList(2, "汉"), { termLang: "zh" })

        yield* seedCard(ada.id, hanzi.words[0]!.id, "term_reading", { due: DUE, hard: true })
        yield* seedCard(ada.id, verbs.words[0]!.id, "term_meaning", { due: DUE, hard: true })
        yield* seedCard(ada.id, verbs.words[1]!.id, "term_reading", { due: DUE, hard: true })

        const page = yield* hardWords(ada.token)

        // The Mandarin word (second 0) is older than the Japanese term_reading word (second 1), so it is first in list order.
        expect(page.summary?.drills).toEqual([
          { drill: "term_meaning", count: 1, termLang: "ja" },
          { drill: "term_reading", count: 2, termLang: "zh" }
        ])
      })
    ))

  test("leaves out cards that are not hard, a snoozed deck's words and another Learner's", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const ben = yield* signedIn("BEN00001")
        const live = yield* seedDeck(ada.id, wordList(3, "語"))
        const sleepy = yield* seedDeck(ada.id, wordList(2, "眠"))
        const theirs = yield* seedDeck(ben.id, wordList(2, "他"))

        yield* seedCard(ada.id, live.words[0]!.id, "term_meaning", { due: DUE, hard: true })
        yield* seedCard(ada.id, live.words[1]!.id, "term_meaning", { due: DUE })
        yield* seedCard(ada.id, sleepy.words[0]!.id, "term_meaning", { due: DUE, hard: true })
        yield* seedCard(ben.id, theirs.words[0]!.id, "term_meaning", { due: DUE, hard: true })
        yield* snoozeDeck(sleepy.deckId)

        const page = yield* hardWords(ada.token)

        expect(page.items.length).toBe(1)
        expect(page.summary).toEqual({
          total: 1,
          dueToday: 1,
          drills: [{ drill: "term_meaning", count: 1, termLang: "ja" }]
        })
      })
    ))

  test("is empty when there are no hard words", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const deck = yield* seedDeck(ada.id, wordList(2, "語"))
        yield* seedCard(ada.id, deck.words[0]!.id, "term_meaning", { due: DUE })

        const page = yield* hardWords(ada.token)

        expect(page.items).toEqual([])
        expect(page.summary).toEqual({ total: 0, dueToday: 0, drills: [] })
      })
    ))
})
