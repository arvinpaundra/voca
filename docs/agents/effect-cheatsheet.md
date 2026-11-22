# Effect 4.1.2 cheat sheet for Voca

Names you remember from Effect 2/3 are often wrong. Everything here was checked against the installed package and is used in the reference slice, the `identity` context (`be/src/identity/**`, `be/test/me.test.ts`). **Copy its shape.**

## Where the truth is

1. **The reference slice:** `be/src/identity/` and `be/test/me.test.ts`. Same layer, same style.
2. **Effect's own docs for LLMs**, shipped in the package: `be/node_modules/effect/AGENTS.md` and `be/node_modules/effect/ai-docs/src/<topic>/` (runnable examples with a short `index.md`). Topics we use:
   - `51_http-server/` (`HttpApi`, handlers, middleware, `HttpApiTest`; the `fixtures/` show a bearer `Authorization` middleware)
   - `40_sql/` (`SqlSchema`, migrations), `09_testing/`, `04_integration/10_managed-runtime.ts`, `01_effect/` (services, layers, errors)
3. **The type definitions** (`be/node_modules/effect/dist/*.d.ts`) and sources (`be/node_modules/effect/src/*.ts`) for exact signatures.

## Renames and idioms (Effect 3 → 4)

| You may remember | Use |
|---|---|
| `Effect.catchAll` | `Effect.catch` (all errors), `Effect.catchTag` / `Effect.catchTags` (by `_tag`) |
| `Context.Tag` / `Context.GenericTag` | `class X extends Context.Service<X, { …shape… }>()("voca/Context/X") {}`; implement with `X.of({ … })` |
| `Layer.effect(Tag, Effect.gen(...))` | same: `Layer.effect(X, Effect.gen(function* () { … return X.of({ … }) }))` |
| `Effect.gen` + helper functions | `Effect.fn("name")(function* (arg) { … })` for reusable functions |
| `Schema.decodeUnknown(S)` | `Schema.decodeUnknownEffect(S)` |
| `Config.string` | `Config.String`, `Config.Redacted`, `Config.Int` |
| bigint from a Postgres `bigint` | select `id::text`, decode with `Schema.BigIntFromString` (`Schema.BigInt` only accepts a real `bigint`) |
| `timestamptz` column | pg returns a `Date`: decode with `Schema.DateTimeUtcFromDate` |
| `Layer.provide` for everything | `Layer.provide` feeds a dependency in; `Layer.provideMerge` feeds it in **and** keeps its services in the output |
| `Effect.Effect.Success<T>` | `Effect.Success<T>` (also `Effect.Error<T>`) |
| `Effect.either` | `Effect.result` → `Result.Result<A, E>` (`Result.isSuccess` / `Result.isFailure`) |
| time in tests | `TestClock.layer()` from `effect/testing` in the test runtime, then `TestClock.setTime(ms)` / `TestClock.adjust("31 days")`; `Clock.currentTimeMillis` follows it |
| handler arguments | `({ params, query, payload }) => …`: path params, query string and body, already decoded by the contract |
| several values in an INSERT / UPDATE | `sql\`INSERT INTO t ${sql.insert({ col: value })}\``, `sql\`UPDATE t SET ${sql.update({ col: value })} WHERE id = ${id}\``: every value a placeholder |
| randomness a test can control | `Random.nextIntBetween(0, 256)` (not `crypto`); tests run the effect under `Random.withSeed("seed")` |
| a test that needs the real web handler | `HttpRouter.toWebHandler(layer, { memoMap: rt.memoMap })` shares the test runtime's database (see `be/test/server.test.ts`) |
| transaction inside a use case | the handler's `Effect.context<…>()` must list `Transaction` too, or the use case's requirement leaks out of the layer |
| shuffle a list | `yield* Random.shuffle(items)` (not `Math.random` or SQL `random()`), so a test's seed controls the order |
| "now" in a query | read it with `DateTime.now` / `Clock.currentTimeMillis` and bind it (`${new Date(now)}::timestamptz`); SQL `now()` ignores the `TestClock` |
| study-day dates in another context | import `studyDay` / `dueAfter` from `be/src/study/domain/studyDay.ts`: a domain file may import another context's domain |
| unhandled infra errors | repositories end with `Effect.orDie`: `SqlError`/`SchemaError` are defects, so ports have no error channel |

## Rules that bit us

- **Handlers run per request.** Acquire ports once in the group builder (`const ports = yield* Effect.context<LearnerRepo>()`) and pass them in with `Effect.provideContext(ports)`. Otherwise the layer keeps a `Request<"Requires", …>` requirement that nothing can satisfy. See `be/src/identity/http/me.ts`, `authorization.ts`.
- **One error mapping place.** Use cases fail with domain errors (`Data.TaggedError`); the handler maps them to contract errors with `Effect.catchTag(..., () => Effect.fail(new NotFound({ … })))`.
- **Unimplemented endpoint**: `Effect.die("not implemented")`, never `throw`.
- **Clock**: read time with `Clock.currentTimeMillis`, never `Date.now()` in `be/src`, so tests can control it.
- **Floating columns**: use `double precision`, never `real`, for values that go back out on the wire (0.9 read back as 0.8999999761581421).
- **Identity tests**: build the runtime with `makeIdentityRuntime(googleStub({...}))` from `be/test/identity.ts`, and call endpoints with `call((c) => c.auth.refresh({ payload }), bearer?)`. See `be/test/refreshTokens.test.ts`.
- **Atomic use cases**: wrap the steps in `Transaction.run(...)` (`be/src/shared/transaction.ts`); `RefreshTokens.findForUpdate` locks its row until the transaction ends.
- **Frontend API calls**: `callApi(options, (client) => client.me.get())` from `fe/src/lib/api.ts` resolves to a `Result`, never rejects; tests pass a fake `fetch` (see `fe/src/lib/api.test.ts`).
- **Tests**: `ManagedRuntime.make(layer)` once per file, `afterAll(() => rt.dispose())`, `beforeEach(() => rt.runPromise(resetDb))`; call endpoints through `HttpApiTest.groups(VocaApi, ["<group>"])` with `Effect.scoped`; attach a bearer with `HttpApiMiddleware.layerClient`. Assert on `error._tag` after `Effect.flip`.
- **Instants in tests**: the typed client decodes `Instant` fields to `DateTime.Utc`, not strings. Compare with `DateTime.formatIso(value)`; `new Date(String(value))` throws.
- **Existing tests of an endpoint**: before locking tests for a change to an endpoint's response, grep `be/test` for the endpoint. An exact-match assertion (`toEqual`) on the old response breaks once the response grows; lock a relaxed version (`toMatchObject`) with the new tests.
- **Moving the clock in API tests**: an access token is signed at the `TestClock`'s time and expires minutes later, so a test that jumps the clock forward (or back) must sign a fresh token after `at(...)`, or every later call answers `401`. See `later()` in `be/test/snooze.test.ts`.
- **Slugs in assertions**: the typed client returns branded slugs; compare them as `String(slug)` with plain strings, or the typecheck fails on `toEqual`.
- **Existing frontend tests of a label**: before changing what a label renders (or rendering it twice, e.g. once for screen readers), grep `fe/src` for `getByText("<label>")`: an exact single-match query breaks. Lock a relaxed version (`getAllByText(...).length`) with the new tests.
- **Stubs a pre-check can see**: a failure only counts as the task's own when its output shows the marker. Put the stub where the failing query prints it: a component stub's DOM appears in a `getBy…` error, but a bare `toBe(true)` on a class prints nothing.
- **Case-insensitive file systems**: a component file named like an existing module (`DeckList.tsx` next to `deckList.ts`) clashes on macOS. Pick another name.
- **Background fibers**: a worker that lives as long as the app is `Layer.effectDiscard(Effect.forkScoped(loop))`. Under a `TestClock` it must not wait with `Effect.sleep` or a `Schedule`: let the external call block instead (beanstalkd's `reserve(seconds)`). See `be/src/library/infrastructure/imports.ts`.
- **TCP sockets**: `BunSocket.makeNet({ host, port, openTimeout })` from `@effect/platform-bun/BunSocket`. A connection that concurrent fibers share takes one permit per command: `Semaphore.make(1)`, then `permit.withPermits(1)(…)`. Write binary bodies as the `Uint8Array` itself; a string gets re-encoded as UTF-8. See `be/src/shared/beanstalk/client.ts`.
- **Server-sent events**: the contract declares `success: HttpApiSchema.StreamSse({ data: Schema })`. The handler returns a `Stream`, here `Stream.fromPubSub(pubsub)` filtered per Learner, and the typed client gets a `Stream` back.
- **Stubs a pre-check can see, again**: never stub a whole layer with `Layer.effectDiscard(Effect.die(…))`. The runtime dies before any test runs, so every test "fails on the stub" and test bugs go unseen. Stub the handlers or use cases instead.
- **400s in API tests**: a payload rejected by the contract's Schema comes back from `HttpApiTest` as a defect, not a failure. `Effect.flip` doesn't catch it; assert `Exit.isFailure` on `Effect.exit`.
