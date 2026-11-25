import { afterAll, expect, test } from "bun:test"
import { Layer, Logger, ManagedRuntime } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { makeApiLayer } from "../src/app.ts"
import { googleStub, TEST_SECRET, testBeanstalk } from "./identity.ts"
import { TestLayer } from "./layers.ts"

// The served API with request logging on, every log line captured.
const logged: Array<unknown> = []
const capture = Logger.layer([Logger.make(({ message }) => logged.push(message))])

const rt = ManagedRuntime.make(TestLayer)
const { handler, dispose } = HttpRouter.toWebHandler(
  makeApiLayer({ jwtSecret: TEST_SECRET, beanstalk: testBeanstalk("request-log") }).pipe(
    Layer.provide(googleStub({})),
    Layer.provide(TestLayer),
    Layer.provide(HttpServer.layerServices),
    Layer.merge(capture)
  ),
  { memoMap: rt.memoMap }
)
afterAll(() => dispose().then(() => rt.dispose()))

const get = (path: string) => handler(new Request(`http://voca.test${path}`))

test("a health probe leaves no log line, while other requests still log one", async () => {
  expect((await get("/api/healthz")).status).toBe(204)
  expect(logged).toEqual([])

  expect((await get("/api/nope")).status).toBe(404)
  expect(logged).toHaveLength(1)
})
