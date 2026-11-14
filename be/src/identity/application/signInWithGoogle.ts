import { Effect } from "effect"
import type { GoogleSignIn } from "@voca/contract"
import type { Transaction } from "../../shared/transaction.ts"
import type { LearnerRecord } from "../domain/learner.ts"
import type { GoogleOAuth, GoogleSignInFailed, LearnerRepo, RefreshTokens, TokenSigner } from "./ports.ts"

export interface SignedInResult {
  readonly learner: LearnerRecord
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresIn: number
}

/** `POST /auth/google`: exchange the code, create or update the Learner, issue tokens. Not implemented yet: task B2. */
export const signInWithGoogle = (
  _input: typeof GoogleSignIn.Type
): Effect.Effect<SignedInResult, GoogleSignInFailed, GoogleOAuth | LearnerRepo | TokenSigner | RefreshTokens | Transaction> =>
  Effect.die("not implemented")
