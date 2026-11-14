import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { HttpRouter } from "effect/http"
import { makeApiLayer } from "./app.ts"
import { GoogleOAuthLive } from "./identity/infrastructure/googleOAuth.ts"
import { AppConfig } from "./shared/config.ts"
import { DbLive } from "./shared/db.ts"
import { migrate } from "../migrations/index.ts"

const program = Effect.gen(function* () {
  const { port, jwtSecret } = yield* AppConfig
  yield* migrate
  yield* Effect.logInfo(`voca-api: migrations applied, serving on :${port}`)
  const server = HttpRouter.serve(makeApiLayer({ jwtSecret }).pipe(Layer.provide(GoogleOAuthLive))).pipe(
    Layer.provide(BunHttpServer.layer({ port }))
  )
  return yield* Layer.launch(server)
}).pipe(Effect.provide(DbLive))

BunRuntime.runMain(program)
