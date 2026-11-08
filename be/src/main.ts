import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"
import { Migrator } from "effect/sql"
import { AppConfig } from "./shared/config.ts"
import { DbLive } from "./shared/db.ts"

import * as Init from "../migrations/0001_init.ts"

// Registered explicitly because Bun's `import.meta.glob` doesn't resolve at build time.
const migrations = Migrator.fromRecord({
  "0001_init": Init.default
})

const program = Effect.gen(function* () {
  const { port } = yield* AppConfig
  yield* Migrator.make({})({ loader: migrations })
  yield* Effect.logInfo(`voca-api: migrations applied, ready on :${port}`)
}).pipe(Effect.provide(DbLive))

// TODO(scaffold): serve VocaApi via HttpApiBuilder + BunHttpServer.
BunRuntime.runMain(program)
