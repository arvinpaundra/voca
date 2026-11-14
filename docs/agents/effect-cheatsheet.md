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
