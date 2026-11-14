import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { VocaApi } from "@voca/contract"

/** `GET /api/healthz`: 204 while the database answers `SELECT 1`. A database error is a defect (500). */
export const SystemHandlers = HttpApiBuilder.group(
  VocaApi,
  "system",
  Effect.fn(function* (handlers) {
    const sql = yield* SqlClient.SqlClient
    return handlers.handleAll({
      healthz: () => sql`SELECT 1`.pipe(Effect.asVoid, Effect.orDie)
    })
  })
)
