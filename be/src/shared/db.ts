import { Config } from "effect"
import { PgClient } from "@effect/sql-pg"

export const DbLive = PgClient.layerConfig({
  url: Config.Redacted("DATABASE_URL"),
  maxConnections: Config.succeed(10)
})
