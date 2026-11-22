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
  decksQuery,
  deckStatsQuery,
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
    ["library.listDecks", decksQuery(), ["library", "decks"], { query: {} }],
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

  test.each([
    ["library.listWords", wordsQuery(DECK, { q: "eat" } as never), { params: { deckSlug: DECK }, query: { q: "eat", cursor: "C1" } }],
    ["study.hardWords", hardWordsQuery(), { query: { cursor: "C1" } }],
    ["community.list", communityQuery({ sort: "new" } as never), { query: { sort: "new", cursor: "C1" } }]
  ] as const)("%s pages on with the last page's cursor", async (endpoint, options, nextRequest) => {
    const { calls, spy } = fakeSession()
    restore = () => spy.mockRestore()

    await queryClient.fetchInfiniteQuery(options as never)
    const next = await (options.queryFn as (context: { pageParam: unknown }) => Promise<unknown>)({ pageParam: "C1" })

    expect(next).toEqual({ items: [], nextCursor: null })
    expect(calls[1]).toEqual({ endpoint, request: nextRequest })
    expect(options.getNextPageParam({ items: [], nextCursor: "C2" } as never, [], undefined, [])).toBe("C2" as never)
    expect(options.getNextPageParam({ items: [], nextCursor: null } as never, [], undefined, [])).toBeUndefined()
  })
})
