import { Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { LearnerLibrary } from "../../identity/application/ports.ts"
import { DeckRepo } from "../application/deckRepo.ts"
import { WordRepo } from "../application/wordRepo.ts"

const LiveDeckId = Schema.Struct({ id: Schema.BigIntFromString })

export const LearnerLibraryLive = Layer.effect(
  LearnerLibrary,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const decks = yield* DeckRepo
    const words = yield* WordRepo

    const liveDeckIdsOf = SqlSchema.findAll({
      Request: Schema.BigInt,
      Result: LiveDeckId,
      execute: (learnerId) => sql`
        SELECT id::text AS id FROM decks WHERE owner_id = ${learnerId} AND deleted_at IS NULL`
    })

    const failPendingImportsOf = (learnerId: bigint) =>
      sql`
        UPDATE import_files
        SET status = 'failed', content = NULL
        FROM import_batches
        WHERE import_batches.id = import_files.batch_id
          AND import_batches.learner_id = ${learnerId}
          AND import_files.status = 'pending'`.pipe(Effect.asVoid, Effect.orDie)

    const eraseDeck = (deckId: bigint, at: number) =>
      Effect.gen(function* () {
        yield* words.softDeleteInDeck(deckId, at)
        yield* decks.softDelete(deckId, at)
      })

    return LearnerLibrary.of({
      eraseAllOf: (learnerId, at) =>
        Effect.gen(function* () {
          const owned = yield* liveDeckIdsOf(learnerId).pipe(Effect.orDie)

          yield* Effect.forEach(owned, (deck) => eraseDeck(deck.id, at))
          yield* failPendingImportsOf(learnerId)
        })
    })
  })
)
