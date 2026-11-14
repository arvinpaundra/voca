import type { Effect, Result } from "effect"
import type { AuthTokens } from "@voca/contract"
import type { ApiClient } from "./api.ts"
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
   * One API call with the session's access token (docs/08 "Frontend handling"): refreshes first when fewer than 60 s
   * remain; on 401 Unauthorized refreshes once and retries once. Resolves to a `Result`, like `callApi`.
   */
  readonly call: <A, E>(f: (client: ApiClient) => Effect.Effect<A, E>) => Promise<Result.Result<A, E | unknown>>
  /** Stores the tokens of a successful sign-in (`POST /auth/google`). */
  readonly signIn: (tokens: AuthTokens) => void
  /** `POST /auth/logout` with the refresh token (best effort), then clears the tokens and calls `onSignedOut`. */
  readonly signOut: () => Promise<void>
}

/** Not implemented yet: task F1. */
export const createSession = (_deps: SessionDeps): Session => ({
  call: () => Promise.reject(new Error("not implemented")),
  signIn: () => {},
  signOut: () => Promise.reject(new Error("not implemented"))
})
