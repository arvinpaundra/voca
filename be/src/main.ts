import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, Logger } from "effect"
import { HttpRouter } from "effect/http"
import { makeApiLayer } from "./app.ts"
import { GoogleOAuthLive } from "./identity/infrastructure/googleOAuth.ts"
import { AppConfig } from "./shared/config.ts"
import { DbLive } from "./shared/db.ts"
import { migrate } from "../migrations/index.ts"

// One JSON object per line: the cluster's log collector stores each line as one entry and indexes its fields,
// so the default multi-line output would split one request into several unrelated entries.
const JsonLogs = Logger.layer([Logger.consoleJson])

const migrateOnly = Effect.gen(function* () {
  yield* migrate
  yield* Effect.logInfo("voca-api: migrations applied")
})

const serve = Effect.gen(function* () {
  const { port, jwtSecret, beanstalkdHost, beanstalkdPort, beanstalkdTube } = yield* AppConfig
  const beanstalk = { host: beanstalkdHost, port: beanstalkdPort, tube: beanstalkdTube }
  yield* Effect.logInfo(`voca-api: serving on :${port}`)

  const server = HttpRouter.serve(makeApiLayer({ jwtSecret, beanstalk }).pipe(Layer.provide(GoogleOAuthLive))).pipe(
    Layer.provide(BunHttpServer.layer({ port }))
  )

  return yield* Layer.launch(server)
})

// The server never migrates: the release runs `voca-api migrate` as a Job and rolls out only once it succeeds,
// so a failed migration never reaches a serving pod.
if (process.argv[2] === "migrate") {
  BunRuntime.runMain(
    migrateOnly.pipe(
      Effect.provide(DbLive),
      Effect.provide(JsonLogs)
    )
  )
} else {
  BunRuntime.runMain(
    serve.pipe(
      Effect.provide(DbLive),
      Effect.provide(JsonLogs)
    )
  )
}
