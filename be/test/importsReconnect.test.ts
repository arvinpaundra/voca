import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { HttpClientRequest } from "effect/http"
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { TestClock } from "effect/testing"
import { Authorization, VocaApi } from "@voca/contract"
import type { ImportBatch, ImportBatchSlug } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { makeBeanstalkProxy } from "./beanstalkProxy.ts"
import { at, call, makeIdentityRuntime, seedLearner, testBeanstalk } from "./identity.ts"
import { resetDb } from "./setup.ts"

// The imports producer and worker keep going after beanstalkd drops their connections, as a beanstalkd restart does,
// without restarting the API. Their connections go through a proxy the test can cut. A dropped connection may only
// show as a missed deadline on the test clock, so each test keeps that clock moving.

const SLOW = 30_000

const proxy = makeBeanstalkProxy()
const rt = makeIdentityRuntime(undefined, { imports: { ...testBeanstalk("importsReconnect"), ...proxy.endpoint } })
afterAll(() => Promise.all([rt.dispose(), proxy.stop()]))
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-22T00:00:00Z"))))

const signedIn = (slug: string) =>
  Effect.gen(function* () {
    yield* seedLearner(slug)
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

const upload = (token: string, name: string) => {
  const form = new FormData()
  form.append("termLang", "ja")
  form.append("meaningLang", "en")
  form.append("files", new Blob(["term,meaning\n語,word\n"], { type: "text/csv" }), name)

  // The in-memory test client doesn't set the multipart content type from the FormData body, as a browser does.
  const headers = HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
    next(
      request.pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeader("content-type", "multipart/form-data")
      )
    )
  )

  return HttpApiTest.groups(VocaApi, ["imports"]).pipe(
    Effect.flatMap((c) => c.imports.importDecks({ payload: form })),
    Effect.provide(headers),
    Effect.scoped
  )
}

const isFinished = (batch: ImportBatch) => batch.files.every((file) => file.status === "done" || file.status === "failed")

/** The batch once every file is finished, polled in real time. */
const finished = (token: string, slug: ImportBatchSlug) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 200; attempt++) {
      const batch = (yield* call((c) => c.imports.listImports(), token)).find((b) => b.slug === slug)

      if (batch !== undefined && isFinished(batch)) {
        return batch
      }

      yield* Effect.promise(() => Bun.sleep(100))
    }

    return yield* Effect.die(`batch ${slug} did not finish in 20 s`)
  })

/** Runs the test with the test clock moving a second every 100 ms of real time, so deadlines and waits pass. */
const ticking = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
  const tick = Effect.andThen(
    TestClock.adjust("1 second"),
    Effect.promise(() => Bun.sleep(100))
  )

  return Effect.raceFirst(effect, Effect.forever(tick))
}

const statuses = (batch: ImportBatch) => batch.files.map((file) => file.status)

describe("imports after beanstalkd drops the connections", () => {
  test("an import after every connection drops still finishes", () =>
    rt.runPromise(
      ticking(Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")

        const first = yield* upload(token, "Before.csv")

        expect(statuses(yield* finished(token, first.slug))).toEqual(["done"])

        yield* Effect.promise(() => proxy.drop())

        const second = yield* upload(token, "After.csv")

        expect(statuses(yield* finished(token, second.slug))).toEqual(["done"])
      }))
    ), SLOW)

  test("an import once beanstalkd is back after a while down still finishes", () =>
    rt.runPromise(
      ticking(Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")

        yield* Effect.promise(() => proxy.stop())

        // Long enough for the worker's reserve to fail against nothing listening.
        yield* Effect.promise(() => Bun.sleep(1500))

        proxy.listen()

        const started = yield* upload(token, "Back.csv")

        expect(statuses(yield* finished(token, started.slug))).toEqual(["done"])
      }))
    ), SLOW)
})
