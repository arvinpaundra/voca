import { Result } from "effect"
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

/** Finishes the Google redirect: checks the callback, exchanges the code, stores the tokens. */
export const completeSignIn = async (deps: CallbackDeps): Promise<CallbackOutcome> => {
  const params = new URLSearchParams(deps.search)

  // Read the PKCE first, every time: it is removed on read, so a failed callback cannot be retried with it.
  const pkce = deps.pkce()

  if (params.has("error")) return { kind: "failed", reason: "google-error" }

  const code = params.get("code")
  if (!code) return { kind: "failed", reason: "missing-code" }

  if (pkce === null) return { kind: "failed", reason: "no-pkce" }

  if (params.get("state") !== pkce.state) return { kind: "failed", reason: "state-mismatch" }

  const result = await deps.session.callPublic((client) =>
    client.auth.google({
      payload: {
        code,
        codeVerifier: pkce.verifier,
        redirectUri: deps.redirectUri,
        timezone: deps.timezone
      }
    })
  )
  if (Result.isFailure(result)) return { kind: "failed", reason: "api-error" }

  deps.session.signIn(result.success)
  return { kind: "signed-in", learner: result.success.learner }
}

/**
 * The signed-in Learner on app load, or null when there is no session. The access token never survives a reload,
 * so this goes through the session, which refreshes first.
 */
export const loadCurrentLearner = async (
  session: Session,
  store: Pick<ReturnType<typeof createTokenStore>, "getRefresh">
): Promise<Learner | null> => {
  if (store.getRefresh() === null) return null

  const result = await session.call((client) => client.me.get())
  return Result.isSuccess(result) ? result.success : null
}
