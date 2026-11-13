import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Layer, ManagedRuntime, Redacted } from "effect"
import { HttpClientRequest, HttpServer } from "effect/http"
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { SignJWT } from "jose"
import { Authorization, VocaApi } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { AuthorizationLive } from "../src/identity/http/authorization.ts"
import { MeHandlers } from "../src/identity/http/me.ts"
import { LearnerRepoLive } from "../src/identity/infrastructure/learnerRepo.ts"
import { TokenSignerLive } from "../src/identity/infrastructure/tokenSigner.ts"
import { TestLayer } from "./layers.ts"
import { resetDb } from "./setup.ts"
import { SqlClient } from "effect/sql"

// The reference slice for the identity context: GET /me through the bearer middleware, against real Postgres.
// Copy its shape for new endpoints: seed with SQL, call the typed in-memory client, assert on values and error tags.

const secret = Redacted.make("test-secret-test-secret-test-secret!")
const key = new TextEncoder().encode(Redacted.value(secret))

const Infra = Layer.mergeAll(LearnerRepoLive, TokenSignerLive(secret)).pipe(Layer.provideMerge(TestLayer))
const Api = MeHandlers.pipe(Layer.provideMerge(AuthorizationLive), Layer.provideMerge(Infra))
const rt = ManagedRuntime.make(Layer.mergeAll(Api, HttpServer.layerServices))
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(resetDb))

const makeClient = HttpApiTest.groups(VocaApi, ["me"])
const withBearer = (token: string | null) =>
  HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
    next(token === null ? request : HttpClientRequest.bearerToken(request, token))
  )

const seed = (slug: string, opts: { deleted?: boolean } = {}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`INSERT INTO learners (slug, google_sub, email, name, avatar_url, timezone, day_start_hour, desired_retention,
        new_per_day, default_session_size, default_mode, created_at, deleted_at)
      VALUES (${slug}, ${"sub-" + slug}, 'ada@example.com', 'Ada', NULL, 'Asia/Jakarta', 4, 0.9, 20, 10, 'easy',
        '2026-11-01T00:00:00Z', ${opts.deleted ? new Date() : null})`
  })

const getMe = (token: string | null) =>
  Effect.gen(function* () {
    const client = yield* makeClient
    return yield* client.me.get()
  }).pipe(Effect.provide(withBearer(token)), Effect.scoped)

const signFor = (slug: string) =>
  Effect.gen(function* () {
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

describe("GET /me", () => {
  test("returns the signed-in learner, without the internal id", () =>
    rt.runPromise(
      Effect.gen(function* () {
        yield* seed("ABCDEFGH")
        const learner = yield* getMe(yield* signFor("ABCDEFGH"))
        expect(learner).toMatchObject({ slug: "ABCDEFGH", email: "ada@example.com", name: "Ada", avatarUrl: null })
        expect(learner.settings).toEqual({
          timezone: "Asia/Jakarta", dayStartHour: 4, desiredRetention: 0.9, newPerDay: 20, defaultSessionSize: 10, defaultMode: "easy"
        })
        expect("id" in learner).toBe(false)
      })
    ))

  const rejected = (label: string, token: (slug: string) => Effect.Effect<string | null, never, TokenSigner>, opts?: { deleted?: boolean }) =>
    test(`401 Unauthorized: ${label}`, () =>
      rt.runPromise(
        Effect.gen(function* () {
          yield* seed("ABCDEFGH", opts)
          const error = yield* getMe(yield* token("ABCDEFGH")).pipe(Effect.flip)
          expect(error._tag).toBe("Unauthorized")
        })
      ))

  rejected("no bearer token", () => Effect.succeed(null))
  rejected("garbage token", () => Effect.succeed("not-a-jwt"))
  rejected("a learner that does not exist", () => signFor("ZZZZZZZZ"))
  rejected("a soft-deleted learner", signFor, { deleted: true })
  rejected("a tampered signature", (slug) => signFor(slug).pipe(Effect.map((t) => t.slice(0, -2) + (t.endsWith("AA") ? "BB" : "AA"))))
  rejected("alg none", (slug) =>
    Effect.succeed(
      [{ alg: "none", typ: "JWT" }, { sub: slug, iss: "voca", aud: "voca-web", exp: 4_102_444_800 }]
        .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
        .join(".") + "."
    ))
  rejected("an expired token", (slug) =>
    Effect.promise(() =>
      new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(slug).setIssuer("voca").setAudience("voca-web")
        .setIssuedAt(1_000).setExpirationTime(2_000).sign(key)
    ))
  rejected("the wrong audience", (slug) =>
    Effect.promise(() =>
      new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(slug).setIssuer("voca").setAudience("someone-else")
        .setIssuedAt().setExpirationTime("15m").sign(key)
    ))
})
