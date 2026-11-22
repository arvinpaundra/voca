import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import type { Cursor as CursorSchema, DeckSlug, DeckSort, Drill, WordSlug } from "@voca/contract"
import type { ApiClient } from "./api.ts"
import { session } from "./appSession.ts"
import { PAGE_SIZE } from "./paging.ts"
import { orReject } from "./queryClient.ts"

// Every server read of the app, as query options: one key per resource, `[context, resource, ...params]`.
// Pages pass these to `useQuery(options, queryClient)` and seed or read the cache through the same keys.

type QueryOf<F> = F extends (request: infer R) => unknown ? (R extends { readonly query?: infer Q } ? Q : never) : never

// A paged list's filters, without the cursor that paging adds.
export type WordsFilter = Omit<NonNullable<QueryOf<ApiClient["library"]["listWords"]>>, "cursor">
export type CommunityFilter = Omit<NonNullable<QueryOf<ApiClient["community"]["list"]>>, "cursor">
export type ActivityMonth = NonNullable<QueryOf<ApiClient["insight"]["activity"]>>["month"]

type Cursor = typeof CursorSchema.Type

const FIVE_MINUTES = 5 * 60_000

// The library's filter as the server takes it: an empty search and "all languages" are left out.
export type DeckListFilter = { readonly q?: string; readonly termLang?: string; readonly sort?: DeckSort }

// The Hard words filter: one drill, or none for every drill.
export type HardWordsFilter = { readonly drill?: Drill }

const firstPage = undefined as Cursor | undefined

const nextPage = (page: { readonly nextCursor: Cursor | null }): Cursor | undefined => page.nextCursor ?? undefined

const withCursor = <Q extends object>(query: Q, cursor: Cursor | undefined) =>
  cursor === undefined ? query : { ...query, cursor }

// Every paged list asks for one page of `PAGE_SIZE` items; the cursor is added from the second page on.
const pageQuery = <Q extends object>(query: Q, cursor: Cursor | undefined, limit: number = PAGE_SIZE) =>
  withCursor({ ...query, limit }, cursor)

// The search is trimmed; an empty one is left out, and so is an empty language (every language).
const deckListParams = (filter: DeckListFilter) => {
  const q = filter.q?.trim() ?? ""

  return {
    ...(q === "" ? {} : { q }),
    ...(filter.termLang === undefined || filter.termLang === "" ? {} : { termLang: filter.termLang }),
    ...(filter.sort === undefined ? {} : { sort: filter.sort })
  }
}

export const meQuery = () =>
  queryOptions({
    queryKey: ["me"],
    queryFn: () => orReject(session.call((client) => client.me.get()))
  })

// The bell, the sidebar badge and the Today card: fresh on return to the tab, and every 5 minutes while open.
export const notificationsQuery = () =>
  queryOptions({
    queryKey: ["insight", "notifications"],
    queryFn: () => orReject(session.call((client) => client.insight.notifications())),
    refetchOnWindowFocus: true,
    refetchInterval: FIVE_MINUTES
  })

export const learnerStatsQuery = () =>
  queryOptions({
    queryKey: ["insight", "learnerStats"],
    queryFn: () => orReject(session.call((client) => client.insight.learnerStats()))
  })

export const activityQuery = (month: ActivityMonth) =>
  queryOptions({
    queryKey: ["insight", "activity", month ?? "current"],
    queryFn: () =>
      orReject(session.call((client) => client.insight.activity({ query: month === undefined ? {} : { month } })))
  })

// The library: 15 decks a page for a filter.
export const deckListQuery = (filter: DeckListFilter) =>
  infiniteQueryOptions({
    queryKey: ["library", "decks", filter],
    queryFn: ({ pageParam }) =>
      orReject(
        session.call((client) => client.library.listDecks({ query: pageQuery(deckListParams(filter), pageParam) }))
      ),
    initialPageParam: firstPage,
    getNextPageParam: nextPage
  })

// The dashboard's decks: the most due first, 200 a page.
export const dueDecksQuery = () =>
  infiniteQueryOptions({
    queryKey: ["library", "dueDecks"],
    queryFn: ({ pageParam }) =>
      orReject(
        session.call((client) =>
          client.library.listDecks({ query: pageQuery({ sort: "due" as const }, pageParam, 200) })
        )
      ),
    initialPageParam: firstPage,
    getNextPageParam: nextPage
  })

export const deckQuery = (deckSlug: DeckSlug) =>
  queryOptions({
    queryKey: ["library", "deck", deckSlug],
    queryFn: () => orReject(session.call((client) => client.library.getDeck({ params: { deckSlug } })))
  })

export const deckStatsQuery = (deckSlug: DeckSlug) =>
  queryOptions({
    queryKey: ["insight", "deckStats", deckSlug],
    queryFn: () => orReject(session.call((client) => client.insight.deckStats({ params: { deckSlug } })))
  })

export const wordsQuery = (deckSlug: DeckSlug, filter: WordsFilter) =>
  infiniteQueryOptions({
    queryKey: ["library", "words", deckSlug, filter],
    queryFn: ({ pageParam }) =>
      orReject(
        session.call((client) =>
          client.library.listWords({ params: { deckSlug }, query: pageQuery(filter, pageParam) })
        )
      ),
    initialPageParam: firstPage,
    getNextPageParam: nextPage
  })

export const wordStatsQuery = (wordSlug: WordSlug) =>
  queryOptions({
    queryKey: ["insight", "wordStats", wordSlug],
    queryFn: () => orReject(session.call((client) => client.insight.wordStats({ params: { wordSlug } })))
  })

export const deckDrillsQuery = (deckSlug: DeckSlug) =>
  queryOptions({
    queryKey: ["study", "deckDrills", deckSlug],
    queryFn: () => orReject(session.call((client) => client.study.deckDrills({ params: { deckSlug } })))
  })

export const hardWordsQuery = (filter: HardWordsFilter = {}) =>
  infiniteQueryOptions({
    queryKey: ["study", "hardWords", filter],
    queryFn: ({ pageParam }) =>
      orReject(session.call((client) => client.study.hardWords({ query: pageQuery(filter, pageParam) }))),
    initialPageParam: firstPage,
    getNextPageParam: nextPage
  })

// A live session changes with every answer: always fetched, never served from the cache.
export const activeSessionQuery = () =>
  queryOptions({
    queryKey: ["study", "active"],
    queryFn: () => orReject(session.call((client) => client.study.active())),
    staleTime: 0,
    gcTime: 0
  })

export const communityQuery = (filter: CommunityFilter) =>
  infiniteQueryOptions({
    queryKey: ["community", "decks", filter],
    queryFn: ({ pageParam }) =>
      orReject(session.call((client) => client.community.list({ query: pageQuery(filter, pageParam) }))),
    initialPageParam: firstPage,
    getNextPageParam: nextPage
  })

export const publicDeckQuery = (deckSlug: DeckSlug) =>
  queryOptions({
    queryKey: ["community", "deck", deckSlug],
    queryFn: () => orReject(session.call((client) => client.community.get({ params: { deckSlug } })))
  })
