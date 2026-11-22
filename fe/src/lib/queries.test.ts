import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Effect, Result } from "effect"
import type { DeckSlug, WordSlug } from "@voca/contract"
import type { ApiClient } from "./api"
import { session } from "./appSession"
import {
  activeSessionQuery,
  activityQuery,
  communityQuery,
  deckDrillsQuery,
  deckQuery,
  deckListQuery,
  deckStatsQuery,
  dueDecksQuery,
  hardWordsQuery,
  learnerStatsQuery,
  meQuery,
  notificationsQuery,
  publicDeckQuery,
  wordsQuery,
  wordStatsQuery
} from "./queries"
import { queryClient } from "./queryClient"

const DECK = "DECK000001" as DeckSlug
const WORD = "WRD000000001" as WordSlug

// A fake client: every endpoint records its request and answers with one page that has no next page.
const fakeSession = () => {
  const calls: Array<{ endpoint: string; request: unknown }> = []
  const page = { items: [], nextCursor: null }

  const endpoint = (name: string) => (request?: unknown) => {
    calls.push({ endpoint: name, request })

    return Effect.succeed(page as never)
  }

  const client = {
    me: { get: endpoint("me.get") },
    insight: {
      notifications: endpoint("insight.notifications"),
      learnerStats: endpoint("insight.learnerStats"),
      activity: endpoint("insight.activity"),
      deckStats: endpoint("insight.deckStats"),
      wordStats: endpoint("insight.wordStats")
    },
    library: { listDecks: endpoint("library.listDecks"), getDeck: endpoint("library.getDeck"), listWords: endpoint("library.listWords") },
    study: { deckDrills: endpoint("study.deckDrills"), hardWords: endpoint("study.hardWords"), active: endpoint("study.active") },
    community: { list: endpoint("community.list"), get: endpoint("community.get") }
  }

  const spy = spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient)))
  )

  return { calls, spy }
}

let restore: (() => void) | null = null

afterEach(() => {
  restore?.()
  restore = null
})

describe("queries", () => {
  test.each([
    ["me.get", meQuery(), ["me"], undefined],
    ["insight.notifications", notificationsQuery(), ["insight", "notifications"], undefined],
    ["insight.learnerStats", learnerStatsQuery(), ["insight", "learnerStats"], undefined],
    ["insight.activity", activityQuery(undefined), ["insight", "activity", "current"], { query: {} }],
    ["insight.activity", activityQuery("2026-10" as never), ["insight", "activity", "2026-10"], { query: { month: "2026-10" } }],
    ["library.getDeck", deckQuery(DECK), ["library", "deck", DECK], { params: { deckSlug: DECK } }],
    ["insight.deckStats", deckStatsQuery(DECK), ["insight", "deckStats", DECK], { params: { deckSlug: DECK } }],
    ["insight.wordStats", wordStatsQuery(WORD), ["insight", "wordStats", WORD], { params: { wordSlug: WORD } }],
    ["study.deckDrills", deckDrillsQuery(DECK), ["study", "deckDrills", DECK], { params: { deckSlug: DECK } }],
    ["study.active", activeSessionQuery(), ["study", "active"], undefined],
    ["community.get", publicDeckQuery(DECK), ["community", "deck", DECK], { params: { deckSlug: DECK } }]
  ] as const)("%s under its key", async (endpoint, options, key, request) => {
    const { calls, spy } = fakeSession()
    restore = () => spy.mockRestore()

    await queryClient.fetchQuery(options as never)

    expect(options.queryKey).toEqual(key as never)
    expect(calls).toEqual([{ endpoint, request }])
  })

  test("the notifications refetch on focus and every 5 minutes", () => {
    expect(notificationsQuery().refetchOnWindowFocus).toBe(true)
    expect(notificationsQuery().refetchInterval).toBe(300_000)
  })

  test("a live session is never served from the cache", () => {
    expect(activeSessionQuery().staleTime).toBe(0)
    expect(activeSessionQuery().gcTime).toBe(0)
  })

  // [endpoint, options, key, first request, next request]: every list asks for its page size, then follows the cursor.
  test.each([
    [
      "library.listDecks",
      () => deckListQuery({}),
      ["library", "decks", {}],
      { query: { limit: 15 } },
      { query: { limit: 15, cursor: "C1" } }
    ],
    [
      "library.listDecks",
      () => deckListQuery({ q: "verb", termLang: "ja", sort: "title" }),
      ["library", "decks", { q: "verb", termLang: "ja", sort: "title" }],
      { query: { q: "verb", termLang: "ja", sort: "title", limit: 15 } },
      { query: { q: "verb", termLang: "ja", sort: "title", limit: 15, cursor: "C1" } }
    ],
    [
      "library.listDecks",
      () => dueDecksQuery(),
      ["library", "dueDecks"],
      { query: { sort: "due", limit: 200 } },
      { query: { sort: "due", limit: 200, cursor: "C1" } }
    ],
    [
      "library.listWords",
      () => wordsQuery(DECK, { q: "eat" } as never),
      ["library", "words", DECK, { q: "eat" }],
      { params: { deckSlug: DECK }, query: { q: "eat", limit: 15 } },
      { params: { deckSlug: DECK }, query: { q: "eat", limit: 15, cursor: "C1" } }
    ],
    [
      "study.hardWords",
      () => hardWordsQuery(),
      ["study", "hardWords", {}],
      { query: { limit: 15 } },
      { query: { limit: 15, cursor: "C1" } }
    ],
    [
      "study.hardWords",
      () => hardWordsQuery({ drill: "reading_term" }),
      ["study", "hardWords", { drill: "reading_term" }],
      { query: { drill: "reading_term", limit: 15 } },
      { query: { drill: "reading_term", limit: 15, cursor: "C1" } }
    ],
    [
      "community.list",
      () => communityQuery({ sort: "new" } as never),
      ["community", "decks", { sort: "new" }],
      { query: { sort: "new", limit: 15 } },
      { query: { sort: "new", limit: 15, cursor: "C1" } }
    ]
  ] as const)("%s pages 15 at a time under its key", async (endpoint, make, key, firstRequest, nextRequest) => {
    const { calls, spy } = fakeSession()
    restore = () => spy.mockRestore()
    const options = make()

    await queryClient.fetchInfiniteQuery(options as never)
    const next = await (options.queryFn as (context: { pageParam: unknown }) => Promise<unknown>)({ pageParam: "C1" })

    expect(options.queryKey).toEqual(key as never)
    expect(next).toEqual({ items: [], nextCursor: null })
    expect(calls).toEqual([
      { endpoint, request: firstRequest },
      { endpoint, request: nextRequest }
    ])
    expect(options.getNextPageParam({ items: [], nextCursor: "C2" } as never, [], undefined, [])).toBe("C2" as never)
    expect(options.getNextPageParam({ items: [], nextCursor: null } as never, [], undefined, [])).toBeUndefined()
  })
})
