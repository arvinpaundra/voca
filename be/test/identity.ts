import { BunFileSystem } from "@effect/platform-bun"
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
import { CommunityHandlers } from "../src/library/http/community.ts"
import { LibraryHandlers } from "../src/library/http/library.ts"
import { DeckRepoLive } from "../src/library/infrastructure/deckRepo.ts"
import { LearnerLibraryLive } from "../src/library/infrastructure/learnerLibrary.ts"
import { WordRepoLive } from "../src/library/infrastructure/wordRepo.ts"
import { ImportEventsHandlers, ImportsHandlers } from "../src/library/http/imports.ts"
import { ImportsLive, type ImportsOptions } from "../src/library/infrastructure/imports.ts"
import { InsightHandlers } from "../src/insight/http/index.ts"
import { InsightLive } from "../src/insight/infrastructure/index.ts"
import { StudyHandlers } from "../src/study/http/index.ts"
import { StudyLive } from "../src/study/infrastructure/index.ts"
import { TestLayer } from "./layers.ts"

// Harness for API tests (identity, library, community, study and insight): the real identity stack against real Postgres, Google stubbed, time on a TestClock.
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

/** The test beanstalkd (preload.ts), on a tube of its own so one file's worker never takes another's jobs. */
export const testBeanstalk = (name: string): ImportsOptions => ({
  host: process.env.TEST_BEANSTALKD_HOST ?? "127.0.0.1",
  port: Number(process.env.TEST_BEANSTALKD_PORT),
  tube: `test-${name}-${process.pid}-${Date.now()}`
})

/** `imports`: the beanstalkd tube for the imports worker; by default a fresh one. */
export const makeIdentityRuntime = (google = googleStub({}), options: { readonly imports?: ImportsOptions } = {}) => {
  const infra = Layer.mergeAll(
    LearnerRepoLive,
    RefreshTokensLive,
    TransactionLive,
    TokenSignerLive(TEST_SECRET),
    DeckRepoLive,
    WordRepoLive,
    LearnerLibraryLive.pipe(Layer.provide(Layer.mergeAll(DeckRepoLive, WordRepoLive))),
    StudyLive,
    InsightLive,
    google
  ).pipe(Layer.provideMerge(TestLayer))

  // Every group of the contract needs its handlers, so the imports worker always runs, on a tube of this file's own.
  const imports = Layer.mergeAll(ImportsHandlers, ImportEventsHandlers).pipe(
    Layer.provide(ImportsLive(options.imports ?? testBeanstalk("api")))
  )

  const api = Layer.mergeAll(MeHandlers, AuthHandlers, LibraryHandlers, CommunityHandlers, StudyHandlers, InsightHandlers, imports).pipe(
    Layer.provideMerge(AuthorizationLive),
    Layer.provideMerge(infra)
  )

  // layerServices brings a no-op FileSystem; a multipart upload is written to disk before its handler runs, so the
  // tests need the real one, as the Bun server provides in production. Merged after it, it replaces the no-op.
  return ManagedRuntime.make(Layer.mergeAll(api, HttpServer.layerServices, BunFileSystem.layer, TestClock.layer()))
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
const makeClient = () => HttpApiTest.groups(VocaApi, ["auth", "me", "library", "community", "study", "insight", "imports", "importEvents"])

/** Moves the test clock to an ISO instant, e.g. `at("2026-11-14T00:00:00Z")`. */
export const at = (iso: string) => TestClock.setTime(Date.parse(iso))

/** Inserts a Learner with the new-Learner defaults and returns its internal id. */
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
