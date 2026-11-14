import { Effect, Option } from "effect"
import { Transaction } from "../../shared/transaction.ts"
import { RefreshTokens } from "./ports.ts"

/**
 * `POST /auth/logout`: revokes the token's family. Never fails: it doesn't say whether the token existed,
 * so an unknown or already-revoked token is a no-op that still answers 204.
 */
export const logout = (refreshToken: string): Effect.Effect<void, never, RefreshTokens | Transaction> =>
  Effect.gen(function* () {
    const tokens = yield* RefreshTokens
    const transaction = yield* Transaction
    yield* transaction.run(
      Effect.gen(function* () {
        const found = yield* tokens.findForUpdate(refreshToken)
        if (Option.isSome(found)) yield* tokens.revokeFamily(found.value.familyId)
      })
    )
  })
