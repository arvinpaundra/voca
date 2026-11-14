import { Effect } from "effect"
import type { Transaction } from "../../shared/transaction.ts"
import type { RefreshTokens } from "./ports.ts"

/** `POST /auth/logout`: revokes the token's family (docs/08). Not implemented yet: task B4. */
export const logout = (_refreshToken: string): Effect.Effect<void, never, RefreshTokens | Transaction> =>
  Effect.die("not implemented")
