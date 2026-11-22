import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { DeckSort } from "@voca/contract"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"
import { SqlClient } from "effect/sql"

// GET /decks: the Learner's decks a page at a time, with search, language filter and sort on the server.
// `total` and `termLangs` always describe the whole library. The clock is 2026-11-14T00:00Z.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const DUE = "2026-11-13T12:00:00Z"
const FIRST_CREATED = Date.parse("2026-11-01T00:00:00Z")

type ListQuery = { q?: string; termLang?: string; sort?: DeckSort; cursor?: string; limit?: number }

const list = (token: string, query: ListQuery = {}) => call((c) => c.library.listDecks({ query }), token)

type DeckSeed = {
  readonly title: string
  readonly createdAt?: string
  readonly updatedAt?: string
  readonly words?: number
  readonly due?: number
  readonly termLang?: string
}

/** A deck with `words` words, the first `due` of them with a card due now; the times are set after the insert. */
const deckOf = (ownerId: bigint, seed: DeckSeed) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const deck = yield* seedDeck(ownerId, wordList(seed.words ?? 0, seed.title), {
      title: seed.title,
      termLang: seed.termLang ?? "ja"
    })

    const createdAt = new Date(seed.createdAt ?? "2026-11-01T00:00:00Z")
    const updatedAt = new Date(seed.updatedAt ?? createdAt.toISOString())
    yield* sql`UPDATE decks SET created_at = ${createdAt}, updated_at = ${updatedAt} WHERE id = ${deck.deckId}`

    for (const word of deck.words.slice(0, seed.due ?? 0)) {
      yield* seedCard(ownerId, word.id, "term_meaning", { due: DUE })
    }

    return deck
  })

/** `count` decks "Deck 00", "Deck 01", … created a minute apart, the last one newest. */
const manyDecks = (ownerId: bigint, count: number, termLang = "ja") =>
  Effect.forEach(
    Array.from({ length: count }, (_, i) => i),
    (i) =>
      deckOf(ownerId, {
        title: `Deck ${String(i).padStart(2, "0")}`,
        createdAt: new Date(FIRST_CREATED + i * 60_000).toISOString(),
        termLang
      })
  )

/** Follows `nextCursor` to the end; every page keeps the same query. */
const allPages = (token: string, query: ListQuery) =>
  Effect.gen(function* () {
    const pages = []
    let cursor: string | undefined

    do {
      const page = yield* list(token, cursor === undefined ? query : { ...query, cursor })
      pages.push(page)
      cursor = page.nextCursor ?? undefined
    } while (cursor !== undefined)

    return pages
  })

const titles = (page: { readonly items: ReadonlyArray<{ readonly title: string }> }) => page.items.map((deck) => deck.title)

describe("GET /decks paging", () => {
  test("40 decks come 15, 15 and 10 at a time, newest first, none twice", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        yield* manyDecks(ada.id, 40)

        const pages = yield* allPages(ada.token, { limit: 15 })

        expect(pages.map((page) => page.items.length)).toEqual([15, 15, 10])
        expect(pages.map((page) => page.nextCursor === null)).toEqual([false, false, true])

        const all = pages.flatMap(titles)

        expect(new Set(all).size).toBe(40)
        expect(all[0]).toBe("Deck 39")
        expect(all.at(-1)).toBe("Deck 00")
        expect(all).toEqual(Array.from({ length: 40 }, (_, i) => `Deck ${String(39 - i).padStart(2, "0")}`))
      })
    ))

  test("a page holds 50 decks when the query has no limit", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        yield* manyDecks(ada.id, 52)

        const first = yield* list(ada.token)

        expect(first.items.length).toBe(50)
        expect(first.nextCursor).not.toBeNull()
        expect((yield* list(ada.token, { cursor: first.nextCursor! })).items.length).toBe(2)
      })
    ))

  test("total and termLangs cover the whole library on every page, whatever the query", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const bob = yield* signedIn("BEN00001")
        yield* manyDecks(ada.id, 20, "ja")
        yield* deckOf(ada.id, { title: "Hanzi", termLang: "zh-Hans" })
        yield* deckOf(ada.id, { title: "Words", termLang: "en" })
        yield* deckOf(ada.id, { title: "Gone", termLang: "ko" }).pipe(
          Effect.flatMap((deck) => call((c) => c.library.deleteDeck({ params: { deckSlug: deck.deckSlug as never } }), ada.token))
        )
        yield* deckOf(bob.id, { title: "Bob's", termLang: "fr" })

        const first = yield* list(ada.token, { limit: 5 })
        const second = yield* list(ada.token, { limit: 5, cursor: first.nextCursor! })
        const searched = yield* list(ada.token, { q: "hanzi" })
        const filtered = yield* list(ada.token, { termLang: "en" })

        for (const page of [first, second, searched, filtered]) {
          expect(page.total).toBe(22)
          expect(page.termLangs).toEqual(["en", "ja", "zh-Hans"])
        }
      })
    ))

  test("a new deck added between pages is not repeated and the pages already read keep their order", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        yield* manyDecks(ada.id, 10)

        const first = yield* list(ada.token, { limit: 4 })
        yield* deckOf(ada.id, { title: "Brand new", createdAt: "2026-11-13T00:00:00Z" })
        const second = yield* list(ada.token, { limit: 4, cursor: first.nextCursor! })
        const third = yield* list(ada.token, { limit: 4, cursor: second.nextCursor! })

        expect(titles(first)).toEqual(["Deck 09", "Deck 08", "Deck 07", "Deck 06"])
        expect(titles(second)).toEqual(["Deck 05", "Deck 04", "Deck 03", "Deck 02"])
        expect(titles(third)).toEqual(["Deck 01", "Deck 00"])
        expect(third.nextCursor).toBeNull()
      })
    ))

  test("a deck deleted between pages does not shift the next page", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const decks = yield* manyDecks(ada.id, 10)

        const first = yield* list(ada.token, { limit: 4 })
        yield* call((c) => c.library.deleteDeck({ params: { deckSlug: decks[8]!.deckSlug as never } }), ada.token)
        const second = yield* list(ada.token, { limit: 4, cursor: first.nextCursor! })
        const third = yield* list(ada.token, { limit: 4, cursor: second.nextCursor! })

        expect(titles(second)).toEqual(["Deck 05", "Deck 04", "Deck 03", "Deck 02"])
        expect(titles(third)).toEqual(["Deck 01", "Deck 00"])
      })
    ))

  test("a Learner pages only their own decks", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const bob = yield* signedIn("BEN00001")
        yield* manyDecks(ada.id, 3)
        yield* deckOf(bob.id, { title: "Bob's" })

        const pages = yield* allPages(bob.token, { limit: 2 })

        expect(pages.flatMap(titles)).toEqual(["Bob's"])
        expect(pages[0]!.total).toBe(1)
      })
    ))
})

describe("GET /decks search and filter", () => {
  test("q matches the title without regard to case, and paging continues inside the matches", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        yield* manyDecks(ada.id, 20)
        yield* deckOf(ada.id, { title: "Verbs N5", createdAt: "2026-11-05T00:00:00Z" })
        yield* deckOf(ada.id, { title: "verbs n4", createdAt: "2026-11-06T00:00:00Z" })
        yield* deckOf(ada.id, { title: "Nouns", createdAt: "2026-11-07T00:00:00Z" })

        const pages = yield* allPages(ada.token, { q: "VERBS", limit: 1 })

        expect(pages.flatMap(titles)).toEqual(["verbs n4", "Verbs N5"])
        expect(pages.length).toBe(2)
      })
    ))

  test("a % or _ in q is plain text", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        yield* deckOf(ada.id, { title: "100% sure" })
        yield* deckOf(ada.id, { title: "1000 sure" })
        yield* deckOf(ada.id, { title: "a_b" })
        yield* deckOf(ada.id, { title: "axb" })

        expect(titles(yield* list(ada.token, { q: "0% s" }))).toEqual(["100% sure"])
        expect(titles(yield* list(ada.token, { q: "a_b" }))).toEqual(["a_b"])
      })
    ))

  test("termLang keeps only decks with exactly that term language", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        yield* manyDecks(ada.id, 20, "ja")
        yield* deckOf(ada.id, { title: "Hanzi", termLang: "zh-Hans" })
        yield* deckOf(ada.id, { title: "Hant", termLang: "zh-Hant" })

        const zh = yield* list(ada.token, { termLang: "zh-Hans" })
        const ja = yield* allPages(ada.token, { termLang: "ja", limit: 15 })

        expect(titles(zh)).toEqual(["Hanzi"])
        expect(ja.map((page) => page.items.length)).toEqual([15, 5])
      })
    ))

  test("q and termLang together", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        yield* deckOf(ada.id, { title: "Verbs", termLang: "ja" })
        yield* deckOf(ada.id, { title: "Verbs", termLang: "ko" })
        yield* deckOf(ada.id, { title: "Nouns", termLang: "ko" })

        const page = yield* list(ada.token, { q: "verbs", termLang: "ko" })

        expect(page.items.map((deck) => `${deck.title}/${deck.termLang}`)).toEqual(["Verbs/ko"])
      })
    ))
})

describe("GET /decks sort", () => {
  test("title is A to Z without regard to case", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        for (const title of ["banana", "Cherry", "apple", "Date", "Apricot"]) {
          yield* deckOf(ada.id, { title })
        }

        const pages = yield* allPages(ada.token, { sort: "title", limit: 2 })

        expect(pages.flatMap(titles)).toEqual(["apple", "Apricot", "banana", "Cherry", "Date"])
      })
    ))

  test("words is the biggest deck first, ties by title, and pages do not repeat", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const sizes = [3, 0, 5, 3, 1, 5, 2]
        for (const [i, words] of sizes.entries()) {
          yield* deckOf(ada.id, { title: `D${i}`, words })
        }

        const pages = yield* allPages(ada.token, { sort: "words", limit: 3 })

        expect(pages.flatMap(titles)).toEqual(["D2", "D5", "D0", "D3", "D6", "D4", "D1"])
        expect(pages.flatMap((page) => page.items.map((deck) => deck.wordCount))).toEqual([5, 5, 3, 3, 2, 1, 0])
      })
    ))

  test("due is the deck with the most cards due now first, ties by title", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        yield* deckOf(ada.id, { title: "B", words: 4, due: 1 })
        yield* deckOf(ada.id, { title: "A", words: 4, due: 1 })
        yield* deckOf(ada.id, { title: "C", words: 4, due: 3 })
        yield* deckOf(ada.id, { title: "D", words: 4, due: 0 })

        const pages = yield* allPages(ada.token, { sort: "due", limit: 3 })

        expect(pages.flatMap(titles)).toEqual(["C", "A", "B", "D"])
        expect(pages.flatMap((page) => page.items.map((deck) => deck.dueCount))).toEqual([3, 1, 1, 0])
      })
    ))

  test("recent is the deck edited last first", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        yield* deckOf(ada.id, { title: "Old", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z" })
        yield* deckOf(ada.id, { title: "Edited", createdAt: "2026-11-02T00:00:00Z", updatedAt: "2026-11-12T00:00:00Z" })
        yield* deckOf(ada.id, { title: "New", createdAt: "2026-11-10T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z" })

        const pages = yield* allPages(ada.token, { sort: "recent", limit: 2 })

        expect(pages.flatMap(titles)).toEqual(["Edited", "New", "Old"])
      })
    ))

  test("a sort keeps working with a search, a filter and a small page", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        for (const [i, words] of [4, 1, 3, 2].entries()) {
          yield* deckOf(ada.id, { title: `Verbs ${i}`, words, termLang: "ja" })
        }
        yield* deckOf(ada.id, { title: "Verbs ko", words: 9, termLang: "ko" })

        const pages = yield* allPages(ada.token, { q: "verbs", termLang: "ja", sort: "words", limit: 2 })

        expect(pages.flatMap(titles)).toEqual(["Verbs 0", "Verbs 2", "Verbs 3", "Verbs 1"])
      })
    ))
})
