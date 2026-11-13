import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"
import { AppConfig } from "./shared/config.ts"
import { DbLive } from "./shared/db.ts"
import { migrate } from "../migrations/index.ts"

const program = Effect.gen(function* () {
  const { port } = yield* AppConfig
  yield* migrate
  yield* Effect.logInfo(`voca-api: migrations applied, ready on :${port}`)
}).pipe(Effect.provide(DbLive))

// TODO(scaffold): serve VocaApi via HttpApiBuilder + BunHttpServer.
BunRuntime.runMain(program)
