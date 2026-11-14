import type { Learner } from "@voca/contract"
import type { Session } from "./session.ts"
import type { createTokenStore } from "./tokens.ts"

export type SignInFailure = "google-error" | "missing-code" | "no-pkce" | "state-mismatch" | "api-error"

export type CallbackOutcome =
  | { readonly kind: "signed-in"; readonly learner: Learner }
  | { readonly kind: "failed"; readonly reason: SignInFailure }

export interface CallbackDeps {
  /** `window.location.search` on `/auth/callback`, e.g. `?code=…&state=…`. */
  readonly search: string
  /** Reads and removes the PKCE verifier and state stored before the redirect; null when there are none. */
  readonly pkce: () => { readonly verifier: string; readonly state: string } | null
  readonly session: Session
  readonly redirectUri: string
  readonly timezone: string
}

/** Finishes the Google redirect: checks the callback, exchanges the code, stores the tokens. Not implemented yet. */
export const completeSignIn = (_deps: CallbackDeps): Promise<CallbackOutcome> =>
  Promise.reject(new Error("not implemented"))

/**
 * The signed-in Learner on app load, or null when there is no session. The access token never survives a reload,
 * so this goes through the session, which refreshes first. Not implemented yet.
 */
export const loadCurrentLearner = (
  _session: Session,
  _store: Pick<ReturnType<typeof createTokenStore>, "getRefresh">
): Promise<Learner | null> =>
  Promise.reject(new Error("not implemented"))
