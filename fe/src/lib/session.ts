import { Result, type Effect } from "effect"
import type { AuthTokens } from "@voca/contract"
import { callApi, type ApiClient, type ApiOptions } from "./api.ts"
import type { createTokenStore } from "./tokens.ts"

export interface SessionDeps {
  readonly store: ReturnType<typeof createTokenStore>
  readonly baseUrl?: string
  readonly fetch?: typeof globalThis.fetch
  readonly lock: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  readonly now: () => number
  readonly onSignedOut: () => void
}

export interface Session {
  readonly call: <A, E>(f: (client: ApiClient) => Effect.Effect<A, E>) => Promise<Result.Result<A, E | unknown>>
  readonly callPublic: <A, E>(f: (client: ApiClient) => Effect.Effect<A, E>) => Promise<Result.Result<A, E | unknown>>
  readonly signIn: (tokens: AuthTokens) => void
  readonly signOut: () => Promise<void>
}

const REFRESH_LOCK = "voca-refresh"

type Rotation = "rotated" | "rejected" | "failed"

const hasTag = (error: unknown, tag: string): boolean =>
  typeof error === "object" && error !== null && "_tag" in error && error._tag === tag

const isUnauthorized = (error: unknown): boolean => hasTag(error, "Unauthorized")

export const createSession = (deps: SessionDeps): Session => {
  const { store } = deps
  const options = (getAccessToken: () => string | null): ApiOptions => ({
    getAccessToken,
    ...(deps.baseUrl !== undefined && { baseUrl: deps.baseUrl }),
    ...(deps.fetch !== undefined && { fetch: deps.fetch })
  })

  const signedOut = (): void => {
    store.clear()
    deps.onSignedOut()
  }

  let inFlight: Promise<Rotation> | null = null

  const rotate = async (): Promise<Rotation> => {
    const refreshToken = store.getRefresh()
    if (refreshToken === null) return "rejected"

    const result = await callApi(options(() => null), (c) => c.auth.refresh({ payload: { refreshToken } }))
    if (Result.isFailure(result)) return hasTag(result.failure, "RefreshTokenInvalid") ? "rejected" : "failed"

    store.setRefresh(result.success.refreshToken)
    store.setAccess(result.success.accessToken, result.success.expiresIn, deps.now())
    return "rotated"
  }

  const refresh = (): Promise<Rotation> => {
    if (inFlight === null) {
      inFlight = deps
        .lock(REFRESH_LOCK, rotate)
        .then((outcome) => {
          if (outcome === "rejected") signedOut()
          return outcome
        })
        .finally(() => {
          inFlight = null
        })
    }
    return inFlight
  }

  const call = async <A, E>(f: (client: ApiClient) => Effect.Effect<A, E>): Promise<Result.Result<A, E | unknown>> => {
    const needsRefresh = store.getRefresh() !== null && store.needsRefresh(deps.now())
    if (needsRefresh && (await refresh()) === "rejected") return Result.fail(new Error("signed out"))

    const used = store.getAccess()
    const attempt = () => callApi(options(() => store.getAccess()), f)
    const first = await attempt()
    if (Result.isSuccess(first) || !isUnauthorized(first.failure)) return first
    if (store.getAccess() === used && (await refresh()) !== "rotated") return first
    return attempt()
  }

  const callPublic = <A, E>(f: (client: ApiClient) => Effect.Effect<A, E>): Promise<Result.Result<A, E | unknown>> =>
    callApi(options(() => null), f)

  const signIn = (tokens: AuthTokens): void => {
    store.setRefresh(tokens.refreshToken)
    store.setAccess(tokens.accessToken, tokens.expiresIn, deps.now())
  }

  const signOut = async (): Promise<void> => {
    const refreshToken = store.getRefresh()
    if (refreshToken !== null) {
      await callApi(options(() => null), (c) => c.auth.logout({ payload: { refreshToken } }))
    }
    signedOut()
  }

  return { call, callPublic, signIn, signOut }
}
