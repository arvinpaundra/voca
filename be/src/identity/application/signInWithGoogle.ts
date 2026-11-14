import { Effect } from "effect"
import type { GoogleSignIn } from "@voca/contract"
import { Transaction } from "../../shared/transaction.ts"
import type { LearnerRecord } from "../domain/learner.ts"
import { GoogleOAuth, GoogleSignInFailed, LearnerRepo, RefreshTokens, TokenSigner } from "./ports.ts"

export interface SignedInResult {
  readonly learner: LearnerRecord
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresIn: number
}

/** `POST /auth/google`. Google first; the database writes are one transaction after it. */
export const signInWithGoogle = (
  input: typeof GoogleSignIn.Type
): Effect.Effect<SignedInResult, GoogleSignInFailed, GoogleOAuth | LearnerRepo | TokenSigner | RefreshTokens | Transaction> =>
  Effect.gen(function* () {
    const google = yield* GoogleOAuth
    const learners = yield* LearnerRepo
    const refreshTokens = yield* RefreshTokens
    const signer = yield* TokenSigner
    const transaction = yield* Transaction

    const profile = yield* google.exchange({
      code: input.code,
      codeVerifier: input.codeVerifier,
      redirectUri: input.redirectUri
    })
    return yield* transaction.run(
      Effect.gen(function* () {
        const learner = yield* learners.upsertGoogle(profile, input.timezone)
        const refresh = yield* refreshTokens.issue(learner.id) // a new family on every sign-in
        const access = yield* signer.sign(learner.slug)
        return { learner, accessToken: access.token, refreshToken: refresh.token, expiresIn: access.expiresIn }
      })
    )
  })
