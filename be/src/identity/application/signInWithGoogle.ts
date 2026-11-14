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

/** `POST /auth/google` (docs/08 steps 4-8, ADR 28). Not implemented yet: task B2. */
export const signInWithGoogle = (
  _input: typeof GoogleSignIn.Type
): Effect.Effect<SignedInResult, GoogleSignInFailed, GoogleOAuth | LearnerRepo | TokenSigner | RefreshTokens | Transaction> =>
  Effect.die("not implemented")
