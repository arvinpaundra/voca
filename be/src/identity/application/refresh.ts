import { Effect } from "effect"
import type { Transaction } from "../../shared/transaction.ts"
import type { RefreshTokenRejected } from "../domain/auth.ts"
import type { LearnerRepo, RefreshTokens, TokenSigner } from "./ports.ts"

export interface RotatedTokens {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresIn: number
}

/** `POST /auth/refresh`: rotation with reuse detection (docs/08). Not implemented yet: task B3. */
export const refresh = (
  _refreshToken: string
): Effect.Effect<RotatedTokens, RefreshTokenRejected, RefreshTokens | LearnerRepo | TokenSigner | Transaction> =>
  Effect.die("not implemented")
