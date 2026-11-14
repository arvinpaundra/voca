import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Layer, ManagedRuntime, Redacted } from "effect"
import { HttpClientRequest, HttpServer } from "effect/http"
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { SqlClient } from "effect/sql"
import type { UpdateSettings } from "@voca/contract"
import { Authorization, VocaApi } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { AuthorizationLive } from "../src/identity/http/authorization.ts"
import { MeHandlers } from "../src/identity/http/me.ts"
import { LearnerRepoLive } from "../src/identity/infrastructure/learnerRepo.ts"
import { TokenSignerLive } from "../src/identity/infrastructure/tokenSigner.ts"
import { TestLayer } from "./layers.ts"
import { resetDb } from "./setup.ts"

// PATCH /me/settings: every field optional, an absent key leaves the setting unchanged,
// the response is the whole Learner. Invariants live in the contract's Schemas, so the database has no CHECKs.
// Same harness as me.test.ts, the reference slice.

const Infra = Layer.mergeAll(LearnerRepoLive, TokenSignerLive(Redacted.make("test-secret-test-secret-test-secret!"))).pipe(
  Layer.provideMerge(TestLayer)
)
const Api = MeHandlers.pipe(Layer.provideMerge(AuthorizationLive), Layer.provideMerge(Infra))
const rt = ManagedRuntime.make(Layer.mergeAll(Api, HttpServer.layerServices))
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(resetDb))

const makeClient = HttpApiTest.groups(VocaApi, ["me"])
const withBearer = (token: string | null) =>
  HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
    next(token === null ? request : HttpClientRequest.bearerToken(request, token))
  )

// Defaults of a new Learner, timezone Asia/Jakarta.
const DEFAULTS = {
  timezone: "Asia/Jakarta", dayStartHour: 4, desiredRetention: 0.9, newPerDay: 20, defaultSessionSize: 10, defaultMode: "easy"
} as const

const seed = (slug: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`INSERT INTO learners (slug, google_sub, email, name, avatar_url, timezone, day_start_hour, desired_retention,
        new_per_day, default_session_size, default_mode, created_at)
      VALUES (${slug}, ${"sub-" + slug}, ${slug.toLowerCase() + "@example.com"}, ${"Learner " + slug}, NULL, 'Asia/Jakarta', 4, 0.9, 20, 10, 'easy',
        '2026-11-01T00:00:00Z')`
  })

const tokenFor = (slug: string) =>
  Effect.gen(function* () {
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

type Patch = typeof UpdateSettings.Type

const patch = (token: string | null, payload: Patch) =>
  Effect.gen(function* () {
    const client = yield* makeClient
    return yield* client.me.updateSettings({ payload })
  }).pipe(Effect.provide(withBearer(token)), Effect.scoped)

const me = (token: string) =>
  Effect.gen(function* () {
    const client = yield* makeClient
    return yield* client.me.get()
  }).pipe(Effect.provide(withBearer(token)), Effect.scoped)

describe("PATCH /me/settings", () => {
  test("changes one setting and leaves the others", () =>
    rt.runPromise(
      Effect.gen(function* () {
        yield* seed("ABCDEFGH")
        const learner = yield* patch(yield* tokenFor("ABCDEFGH"), { newPerDay: 35 })
        expect(learner.settings).toEqual({ ...DEFAULTS, newPerDay: 35 })
        expect(String(learner.slug)).toBe("ABCDEFGH")
        expect(learner.email).toBe("abcdefgh@example.com")
      })
    ))

  test("changes every setting at once, and GET /me shows it afterwards", () =>
    rt.runPromise(
      Effect.gen(function* () {
        yield* seed("ABCDEFGH")
        const token = yield* tokenFor("ABCDEFGH")
        const all = { timezone: "Asia/Tokyo", dayStartHour: 2, desiredRetention: 0.85, newPerDay: 5, defaultSessionSize: 15, defaultMode: "hard" } as const
        const learner = yield* patch(token, all)
        expect(learner.settings).toEqual(all) // 0.85 comes back as 0.85, not a float4 approximation
        expect((yield* me(token)).settings).toEqual(all)
      })
    ))

  test("an empty patch changes nothing and still answers with the Learner", () =>
    rt.runPromise(
      Effect.gen(function* () {
        yield* seed("ABCDEFGH")
        const learner = yield* patch(yield* tokenFor("ABCDEFGH"), {})
        expect(learner.settings).toEqual(DEFAULTS)
      })
    ))

  test("only the caller's row changes", () =>
    rt.runPromise(
      Effect.gen(function* () {
        yield* seed("ABCDEFGH")
        yield* seed("JKMNPQRS")
        yield* patch(yield* tokenFor("ABCDEFGH"), { defaultMode: "hard", timezone: "UTC" })
        expect((yield* me(yield* tokenFor("JKMNPQRS"))).settings).toEqual(DEFAULTS)
        expect((yield* me(yield* tokenFor("ABCDEFGH"))).settings).toEqual({ ...DEFAULTS, defaultMode: "hard", timezone: "UTC" })
      })
    ))

  test("a value outside the Schema is rejected and nothing is written", () =>
    rt.runPromise(
      Effect.gen(function* () {
        yield* seed("ABCDEFGH")
        const token = yield* tokenFor("ABCDEFGH")
        // newPerDay 201 and retention 0.97 violate the contract's Schemas; the cast skips the client-side check.
        const exit = yield* patch(token, { newPerDay: 201 } as never).pipe(Effect.exit)
        expect(exit._tag).toBe("Failure")
        expect((yield* me(token)).settings).toEqual(DEFAULTS)
      })
    ))

  test("401 Unauthorized without a bearer token", () =>
    rt.runPromise(
      Effect.gen(function* () {
        yield* seed("ABCDEFGH")
        const error = yield* patch(null, { newPerDay: 35 }).pipe(Effect.flip)
        expect(error._tag).toBe("Unauthorized")
      })
    ))
})
