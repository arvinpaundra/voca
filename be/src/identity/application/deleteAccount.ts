import { Clock, Effect } from "effect"
import { CurrentLearner } from "@voca/contract"
import { Transaction } from "../../shared/transaction.ts"
import { LearnerLibrary, LearnerRepo, RefreshTokens } from "./ports.ts"

export const deleteAccount = Effect.gen(function* () {
  const { id } = yield* CurrentLearner
  const learners = yield* LearnerRepo
  const tokens = yield* RefreshTokens
  const library = yield* LearnerLibrary
  const transaction = yield* Transaction
  const at = yield* Clock.currentTimeMillis

  yield* transaction.run(
    Effect.gen(function* () {
      yield* library.eraseAllOf(id, at)
      yield* tokens.revokeAllOf(id)
      yield* learners.erase(id, at)
    })
  )
})
