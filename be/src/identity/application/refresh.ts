import { DateTime, Effect, Option } from "effect"
import { Transaction } from "../../shared/transaction.ts"
import { RefreshTokenRejected } from "../domain/auth.ts"
import { LearnerRepo, RefreshTokens, TokenSigner } from "./ports.ts"

export interface RotatedTokens {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresIn: number
}

/**
 * `POST /auth/refresh`: rotation with reuse detection.
 * The transaction returns the outcome instead of failing: a failure would roll back the family revocation on reuse.
 * The rejection is raised only after the transaction has committed.
 */
export const refresh = (refreshToken: string) =>
  Effect.gen(function* () {
    const tokens = yield* RefreshTokens
    const learners = yield* LearnerRepo
    const signer = yield* TokenSigner
    const transaction = yield* Transaction
    const now = yield* DateTime.now

    const outcome = yield* transaction.run(
      Effect.gen(function* () {
        const found = yield* tokens.findForUpdate(refreshToken)
        if (Option.isNone(found)) return Option.none<RotatedTokens>()
        const row = found.value
        if (row.revokedAt !== null || DateTime.isLessThanOrEqualTo(row.expiresAt, now)) return Option.none<RotatedTokens>()
        if (row.usedAt !== null) {
          yield* tokens.revokeFamily(row.familyId)
          return Option.none<RotatedTokens>()
        }
        const learner = yield* learners.findById(row.learnerId)
        if (Option.isNone(learner)) return Option.none<RotatedTokens>()
        yield* tokens.markUsed(row.id)
        const next = yield* tokens.issue(row.learnerId, row.familyId)
        const access = yield* signer.sign(learner.value.slug)
        return Option.some({ accessToken: access.token, refreshToken: next.token, expiresIn: access.expiresIn })
      })
    )

    return yield* Option.match(outcome, {
      onNone: () => Effect.fail(new RefreshTokenRejected()),
      onSome: Effect.succeed
    })
  })
