import { Result } from "effect"
import type { Learner } from "@voca/contract"
import type { Session } from "./session.ts"
import type { createTokenStore } from "./tokens.ts"

export type SignInFailure = "google-error" | "missing-code" | "no-pkce" | "state-mismatch" | "api-error"

export type CallbackOutcome =
  | { readonly kind: "signed-in"; readonly learner: Learner }
  | { readonly kind: "failed"; readonly reason: SignInFailure }

export interface CallbackDeps {
  readonly search: string
  readonly pkce: () => { readonly verifier: string; readonly state: string } | null
  readonly session: Session
  readonly redirectUri: string
  readonly timezone: string
}

export const completeSignIn = async (deps: CallbackDeps): Promise<CallbackOutcome> => {
  const params = new URLSearchParams(deps.search)

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

export const loadCurrentLearner = async (
  session: Session,
  store: Pick<ReturnType<typeof createTokenStore>, "getRefresh">
): Promise<Learner | null> => {
  if (store.getRefresh() === null) return null

  const result = await session.call((client) => client.me.get())
  return Result.isSuccess(result) ? result.success : null
}
