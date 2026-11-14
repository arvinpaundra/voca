import { Context, Effect, Layer } from "effect"
import { SqlClient } from "effect/sql"

/**
 * Runs an effect in one database transaction (commit on success, rollback on failure).
 * A port, so use cases can be atomic without importing SQL. Database errors are defects.
 */
export class Transaction extends Context.Service<Transaction, {
  run<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
}>()("voca/shared/Transaction") {}

export const TransactionLive = Layer.effect(
  Transaction,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return Transaction.of({
      run: (effect) => sql.withTransaction(effect).pipe(Effect.catchTag("SqlError", Effect.die))
    })
  })
)
