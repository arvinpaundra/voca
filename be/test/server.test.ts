import { afterAll, describe, expect, test } from "bun:test"
import { Effect, Layer, ManagedRuntime } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { makeApiLayer } from "../src/app.ts"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { TokenSignerLive } from "../src/identity/infrastructure/tokenSigner.ts"
import { googleStub, seedLearner, TEST_SECRET } from "./identity.ts"
import { TestLayer } from "./layers.ts"

// The served API (docs/07): real HTTP requests through the web handler that main.ts serves with Bun.
// The test runtime and the handler share one memo map, so they use the same test database.

const rt = ManagedRuntime.make(Layer.mergeAll(TestLayer, TokenSignerLive(TEST_SECRET)))
const { handler, dispose } = HttpRouter.toWebHandler(
  makeApiLayer({ jwtSecret: TEST_SECRET }).pipe(
    Layer.provide(googleStub({})),
    Layer.provide(TestLayer),
    Layer.provide(HttpServer.layerServices)
  ),
  { memoMap: rt.memoMap, disableLogger: true }
)
afterAll(() => dispose().then(() => rt.dispose()))

const get = (path: string, bearer?: string) =>
  handler(new Request(`http://voca.test${path}`, { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} }))

const signedIn = (slug: string) =>
  rt.runPromise(
    Effect.gen(function* () {
      yield* seedLearner(slug)
      return (yield* (yield* TokenSigner).sign(slug as never)).token
    })
  )

describe("served API", () => {
  test("GET /api/healthz answers 204 when the database answers", async () => {
    expect((await get("/api/healthz")).status).toBe(204)
  })

  test("a protected route without a token answers 401 with the contract's error body", async () => {
    const response = await get("/api/me")
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ _tag: "Unauthorized" })
  })

  test("a protected route with a valid token reaches its handler", async () => {
    const token = await signedIn("ABCDEFGH")
    const response = await get("/api/me", token)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ slug: "ABCDEFGH" })
  })

  test("an endpoint that isn't built yet answers 500, and the server keeps serving", async () => {
    const token = await signedIn("JKMNPQRS")
    expect((await get("/api/decks", token)).status).toBe(500)
    expect((await get("/api/healthz")).status).toBe(204)
  })

  test("a path outside the contract answers 404", async () => {
    expect((await get("/api/nope")).status).toBe(404)
  })
})
