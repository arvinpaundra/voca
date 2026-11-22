import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { Drill } from "@voca/contract"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn } from "./seed.ts"
import { resetDb } from "./setup.ts"

// Hard words search: `q` keeps the words whose term, reading or meaning contains it, combines with the drill filter,
// pages like the plain list, and leaves the summary alone. The clock is 2026-11-14T00:00Z.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const DUE = "2026-11-13T12:00:00Z"

type Query = { drill?: Drill; q?: string; cursor?: string; limit?: number }

const hardWords = (token: string, query: Query) => call((c) => c.study.hardWords({ query }), token)

const pad = (n: number) => String(n).padStart(2, "0")

// 40 words, hard in term_meaning when the index is even and in reading_term when it is odd. "spa" hides in the term of
// word 4 (upper case), in the meaning of word 7 and in the reading of word 12.
const seed = Effect.gen(function* () {
  const ada = yield* signedIn("ADA00001")

  const list = Array.from({ length: 40 }, (_, i) => ({
    term: i === 4 ? `ESPAÑA ${pad(i)}` : `word ${pad(i)}`,
    meaning: i === 7 ? `a spa town ${pad(i)}` : `meaning ${pad(i)}`,
    reading: i === 12 ? `spa-${pad(i)}` : `yomi ${pad(i)}`
  }))

  const deck = yield* seedDeck(ada.id, list, { title: "Mixed" })

  for (const [i, word] of deck.words.entries()) {
    yield* seedCard(ada.id, word.id, i % 2 === 0 ? "term_meaning" : "reading_term", { due: DUE, hard: true })
  }

  return { ada, deck }
})

describe("GET /hard-words?q", () => {
  test("finds the words that contain the text in the term, the reading or the meaning", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, deck } = yield* seed

        // Word 4 has "ESPAÑA", whose lower case holds "spa"; the match ignores case.
        const page = yield* hardWords(ada.token, { q: "SPA" })

        expect(page.items.map((item) => String(item.slug)).sort()).toEqual(
          [deck.words[4]!.slug, deck.words[7]!.slug, deck.words[12]!.slug].sort()
        )
        expect(page.nextCursor).toBeNull()
      })
    )
  })

  test("a text nothing contains lists nothing", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada } = yield* seed

        const page = yield* hardWords(ada.token, { q: "zzz" })

        expect(page.items).toEqual([])
        expect(page.nextCursor).toBeNull()
      })
    )
  })

  test("works together with the drill filter", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, deck } = yield* seed

        // Words 4 and 12 are hard in term_meaning, word 7 in reading_term.
        const termMeaning = yield* hardWords(ada.token, { q: "spa", drill: "term_meaning" })
        expect(termMeaning.items.map((item) => String(item.slug)).sort()).toEqual(
          [deck.words[4]!.slug, deck.words[12]!.slug].sort()
        )

        const readingTerm = yield* hardWords(ada.token, { q: "spa", drill: "reading_term" })
        expect(readingTerm.items.map((item) => String(item.slug))).toEqual([deck.words[7]!.slug])
      })
    )
  })

  test("pages the matches without repeating one, and a search starts from the first page", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada } = yield* seed

        // Only the terms "word 10" to "word 19" contain "word 1".
        const first = yield* hardWords(ada.token, { q: "word 1", limit: 4 })
        expect(first.items).toHaveLength(4)
        expect(first.nextCursor).not.toBeNull()

        const second = yield* hardWords(ada.token, { q: "word 1", limit: 4, cursor: first.nextCursor! })
        const third = yield* hardWords(ada.token, { q: "word 1", limit: 4, cursor: second.nextCursor! })

        const terms = [...first.items, ...second.items, ...third.items].map((item) => item.term)
        expect(terms).toEqual(Array.from({ length: 10 }, (_, i) => `word ${10 + i}`))
        expect(third.nextCursor).toBeNull()
      })
    )
  })

  test("the summary still counts every hard word, whatever the search", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada } = yield* seed

        const searched = yield* hardWords(ada.token, { q: "spa" })
        const plain = yield* hardWords(ada.token, {})

        expect(searched.summary).toEqual(plain.summary)
        expect(searched.summary.total).toBe(40)
        expect(searched.summary.drills.map((entry) => entry.count)).toEqual([20, 20])
      })
    )
  })

  test("never shows another learner's words", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        yield* seed
        const bob = yield* signedIn("BB000001")

        const page = yield* hardWords(bob.token, { q: "word" })

        expect(page.items).toEqual([])
      })
    )
  })
})
