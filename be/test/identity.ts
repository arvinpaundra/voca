import { Effect, Layer, ManagedRuntime, Redacted } from "effect"
import { HttpClientRequest, HttpServer } from "effect/http"
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { TestClock } from "effect/testing"
import { Authorization, VocaApi } from "@voca/contract"
import { type GoogleProfile, GoogleOAuth, GoogleSignInFailed } from "../src/identity/application/ports.ts"
import { AuthHandlers } from "../src/identity/http/auth.ts"
import { AuthorizationLive } from "../src/identity/http/authorization.ts"
import { MeHandlers } from "../src/identity/http/me.ts"
import { LearnerRepoLive } from "../src/identity/infrastructure/learnerRepo.ts"
import { RefreshTokensLive } from "../src/identity/infrastructure/refreshTokens.ts"
import { TokenSignerLive } from "../src/identity/infrastructure/tokenSigner.ts"
import { TransactionLive } from "../src/shared/transaction.ts"
import { TestLayer } from "./layers.ts"

// Harness for identity tests: the real identity stack against real Postgres, Google stubbed, time on a TestClock.
// Each file: `const rt = makeIdentityRuntime(googleStub({...})); afterAll(() => rt.dispose()); beforeEach(() => rt.runPromise(resetDb))`.

export const TEST_SECRET = Redacted.make("test-secret-test-secret-test-secret!")

/** Google, stubbed: the auth `code` picks the profile; an unknown code fails like a rejected exchange. */
export const googleStub = (byCode: Record<string, GoogleProfile>) =>
  Layer.succeed(
    GoogleOAuth,
    GoogleOAuth.of({
      exchange: ({ code }) => {
        const profile = byCode[code]
        return profile ? Effect.succeed(profile) : Effect.fail(new GoogleSignInFailed({ reason: `stub: unknown code ${code}` }))
      }
    })
  )

export const makeIdentityRuntime = (google = googleStub({})) => {
  const infra = Layer.mergeAll(LearnerRepoLive, RefreshTokensLive, TransactionLive, TokenSignerLive(TEST_SECRET), google).pipe(
    Layer.provideMerge(TestLayer)
  )
  const api = Layer.mergeAll(MeHandlers, AuthHandlers).pipe(Layer.provideMerge(AuthorizationLive), Layer.provideMerge(infra))
  return ManagedRuntime.make(Layer.mergeAll(api, HttpServer.layerServices, TestClock.layer()))
}

/** Calls the API through the in-memory typed client, optionally with a bearer access token. */
export const call = <A, E, R>(
  f: (client: Effect.Success<ReturnType<typeof makeClient>>) => Effect.Effect<A, E, R>,
  bearer: string | null = null
) =>
  makeClient().pipe(
    Effect.flatMap(f),
    Effect.provide(
      HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
        next(bearer === null ? request : HttpClientRequest.bearerToken(request, bearer))
      )
    ),
    Effect.scoped
  )
const makeClient = () => HttpApiTest.groups(VocaApi, ["auth", "me"])

/** Moves the test clock to an ISO instant, e.g. `at("2026-11-14T00:00:00Z")`. */
export const at = (iso: string) => TestClock.setTime(Date.parse(iso))

/** Inserts a Learner with the ADR 28 defaults and returns its internal id. */
export const seedLearner = (slug: string, googleSub = `sub-${slug}`) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const [row] = yield* sql<{ readonly id: string }>`
      INSERT INTO learners (slug, google_sub, email, name, avatar_url, timezone, day_start_hour, desired_retention,
        new_per_day, default_session_size, default_mode, created_at)
      VALUES (${slug}, ${googleSub}, ${slug.toLowerCase() + "@example.com"}, ${"Learner " + slug}, NULL, 'UTC', 4, 0.9, 20, 10, 'easy',
        '2026-11-01T00:00:00Z')
      RETURNING id::text AS id`
    return BigInt(row!.id)
  })
