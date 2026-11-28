import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import type { Cursor as CursorSchema, DeckSlug, DeckSort, Drill, WordSlug } from "@voca/contract"
import type { ApiClient } from "./api.ts"
import { session } from "./appSession.ts"
import { PAGE_SIZE } from "./paging.ts"
import { orReject } from "./queryClient.ts"

type QueryOf<F> = F extends (request: infer R) => unknown ? (R extends { readonly query?: infer Q } ? Q : never) : never

export type WordsFilter = Omit<NonNullable<QueryOf<ApiClient["library"]["listWords"]>>, "cursor">
export type CommunityFilter = Omit<NonNullable<QueryOf<ApiClient["community"]["list"]>>, "cursor">
export type ActivityMonth = NonNullable<QueryOf<ApiClient["insight"]["activity"]>>["month"]

type Cursor = typeof CursorSchema.Type

const FIVE_MINUTES = 5 * 60_000

export type DeckListFilter = { readonly q?: string; readonly termLang?: string; readonly sort?: DeckSort }

export type HardWordsFilter = { readonly drill?: Drill; readonly q?: string }

const firstPage = undefined as Cursor | undefined

const nextPage = (page: { readonly nextCursor: Cursor | null }): Cursor | undefined => page.nextCursor ?? undefined

const withCursor = <Q extends object>(query: Q, cursor: Cursor | undefined) =>
  cursor === undefined ? query : { ...query, cursor }

const pageQuery = <Q extends object>(query: Q, cursor: Cursor | undefined, limit: number = PAGE_SIZE) =>
  withCursor({ ...query, limit }, cursor)

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

const hardWordsParams = (filter: HardWordsFilter) => {
  const q = filter.q?.trim() ?? ""

  return {
    ...(filter.drill === undefined ? {} : { drill: filter.drill }),
    ...(q === "" ? {} : { q })
  }
}

export const hardWordsQuery = (filter: HardWordsFilter = {}) =>
  infiniteQueryOptions({
    queryKey: ["study", "hardWords", filter],
    queryFn: ({ pageParam }) =>
      orReject(session.call((client) => client.study.hardWords({ query: pageQuery(hardWordsParams(filter), pageParam) }))),
    initialPageParam: firstPage,
    getNextPageParam: nextPage
  })

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
