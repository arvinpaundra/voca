import { Effect } from "effect"
import { HttpMiddleware } from "effect/http"
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
      // The kubelet probes this every few seconds; logging each probe would bury the real requests.
      healthz: () =>
        sql`SELECT 1`.pipe(
          Effect.asVoid,
          Effect.orDie,
          HttpMiddleware.withLoggerDisabled
        )
    })
  })
)
