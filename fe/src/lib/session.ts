import { Result, type Effect } from "effect"
import type { AuthTokens } from "@voca/contract"
import { callApi, type ApiClient, type ApiOptions } from "./api.ts"
import type { createTokenStore } from "./tokens.ts"

export interface SessionDeps {
  /** The token store (tokens.ts): refresh token in storage, access token in memory. */
  readonly store: ReturnType<typeof createTokenStore>
  /** Passed to `callApi`; tests give a fake `fetch`. */
  readonly baseUrl?: string
  readonly fetch?: typeof globalThis.fetch
  /** Web Locks: `(name, fn) => navigator.locks.request(name, fn)`. Only one tab refreshes at a time. */
  readonly lock: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  /** Epoch milliseconds. */
  readonly now: () => number
  /** Called once when the session ends: sign-out, or a refresh that failed. The app then goes to /login. */
  readonly onSignedOut: () => void
}

export interface Session {
  /**
   * One API call with the session's access token: refreshes first when fewer than 60 s
   * remain; on 401 Unauthorized refreshes once and retries once. Resolves to a `Result`, like `callApi`.
   */
  readonly call: <A, E>(f: (client: ApiClient) => Effect.Effect<A, E>) => Promise<Result.Result<A, E | unknown>>
  /** Stores the tokens of a successful sign-in (`POST /auth/google`). */
  readonly signIn: (tokens: AuthTokens) => void
  /** `POST /auth/logout` with the refresh token (best effort), then clears the tokens and calls `onSignedOut`. */
  readonly signOut: () => Promise<void>
}

const REFRESH_LOCK = "voca-refresh"

const isUnauthorized = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "_tag" in error && error._tag === "Unauthorized"

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

  // Concurrent callers share one refresh, so a single rotation happens per burst of 401s.
  let inFlight: Promise<boolean> | null = null

  const rotate = async (): Promise<boolean> => {
    // Read the refresh token here, inside the lock: another tab may have rotated it while we waited.
    const refreshToken = store.getRefresh()
    if (refreshToken === null) return false
    const result = await callApi(options(() => null), (c) => c.auth.refresh({ payload: { refreshToken } }))
    if (Result.isFailure(result)) return false
    store.setRefresh(result.success.refreshToken)
    store.setAccess(result.success.accessToken, result.success.expiresIn, deps.now())
    return true
  }

  const refresh = (): Promise<boolean> => {
    if (inFlight === null) {
      inFlight = deps
        .lock(REFRESH_LOCK, rotate)
        .then((ok) => {
          if (!ok) signedOut()
          return ok
        })
        .finally(() => {
          inFlight = null
        })
    }
    return inFlight
  }

  const call = async <A, E>(f: (client: ApiClient) => Effect.Effect<A, E>): Promise<Result.Result<A, E | unknown>> => {
    if (store.getRefresh() !== null && store.needsRefresh(deps.now()) && !(await refresh())) {
      return Result.fail(new Error("signed out"))
    }
    const used = store.getAccess()
    const attempt = () => callApi(options(() => store.getAccess()), f)
    const first = await attempt()
    if (Result.isSuccess(first) || !isUnauthorized(first.failure)) return first
    // Another call already refreshed while this one was in flight: retry with the new token, without refreshing again.
    if (store.getAccess() === used && !(await refresh())) return first
    return attempt()
  }

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

  return { call, signIn, signOut }
}
