# 03 — Architecture

## Monorepo layout (Bun workspaces)

```
voca/
├── package.json            # workspaces: ["be", "fe", "contract"]; scripts only
├── bunfig.toml
├── tsconfig.base.json      # strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess
├── contract/               # @voca/contract: shared HttpApi + Schemas (no runtime deps beyond effect)
│   └── src/{api.ts, identity.ts, library.ts, study.ts, insight.ts, errors.ts}
├── be/                     # @voca/be: Bun + Effect API
│   ├── src/
│   │   ├── main.ts                 # Layer composition + BunRuntime.runMain
│   │   ├── shared/                 # Config, Db layer, Clock/Random wrappers, tx helper
│   │   ├── identity/{domain,application,infrastructure,http}/
│   │   ├── library/{domain,application,infrastructure,http}/
│   │   ├── study/{domain,application,infrastructure,http}/
│   │   └── insight/{application,infrastructure,http}/   # read models: no domain layer
│   ├── migrations/         # 0001_init.ts … (@effect/sql Migrator)
│   ├── test/               # integration tests (real Postgres)
│   └── Dockerfile
├── fe/                     # @voca/fe: React + TanStack + Vite → Cloudflare Pages
│   ├── src/{routes/, features/, lib/api.ts, main.tsx}
│   ├── public/{_redirects,_headers}
│   └── vite.config.ts
├── deploy/k8s/             # plain YAML: namespace, deployment, service, ingress, secret.example
├── docker-compose.yml      # postgres for local dev + tests
└── docs/
```

The user asked for separate `fe/` and `be/` directories. `contract/` sits beside them because it is the only code both sides import.

## Layers inside a bounded context

```
http  ──▶  application  ──▶  domain
  │             │
  └──▶ infrastructure ◀┘ (implements ports declared in application)
```

| Layer | Contains | May import | Must not |
|---|---|---|---|
| **domain** | Branded types, Schemas, pure functions, `Data.TaggedError` domain errors | `effect` only (`Schema`, `Either`, `Option`, `Data`) | IO, `Effect` services, Clock, SQL |
| **application** | Use cases as `Effect.gen` programs; ports as `Context.Tag` | domain, its own ports | concrete SQL, HTTP |
| **infrastructure** | Repository implementations (`SqlClient`), Google client, JWT signer as `Layer`s | application ports, domain | business rules |
| **http** | `HttpApiBuilder.group` handlers: decode → use case → encode | application, contract | business rules, SQL |

Ports have exactly one implementation each, defined as a `Context.Tag`. In Effect this is the idiomatic way to inject dependencies, not an extra abstraction, and it lets tests swap in a different `Layer`. No other interfaces are introduced.

## Functional & monadic rules (strict)

1. **No `throw`, no `try/catch`, no `async/await`** in `be/` or `contract/`. Use `Effect`, `Either`, and `Option`. Wrap foreign promise calls once with `Effect.tryPromise` in infrastructure.
2. **Errors are values.** Domain errors are `Data.TaggedError`. HTTP-facing errors are `Schema.TaggedError` in `contract/errors.ts`, annotated with an HTTP status. Handlers use `Effect.catchTags` to map one to the other. Defects (bugs) are left to crash the fiber and are logged.
3. **No mutable state** in domain or application code. Data is `readonly` and arrays are `ReadonlyArray`. Updates are made by spreading records or using `Data.struct`.
4. **Time and randomness are effects.** Read them with `Clock.currentTimeMillis` and `Random.next` in the application layer, then pass the values into pure domain functions. Tests use `TestClock` and a seeded `Random`.
5. **Composition style:** use `Effect.gen` for sequential use cases and `pipe` with `Effect.map` / `flatMap` for short transforms. Avoid nesting `flatMap` more than two levels deep.
6. **Validate at the boundary.** Every request and response body is an Effect `Schema` in `contract/`. Rows read from the database are decoded with `SqlSchema` helpers. Inside the boundary, types are trusted.
7. **Branded IDs, two kinds:**
   - Internal `bigint` keys (`DeckId`, …) are used in the domain, application, and infrastructure layers.
   - Slugs (`DeckSlug`, …, random uppercase strings with a length per model) are used only in `contract/` and `http/`.
   - Repositories resolve slugs to internal IDs in the same query as the ownership check, so an internal ID never reaches a response. See [06](06-data-model.md).
8. **Transactions:** wrap each use case that writes in `sql.withTransaction`. Each answer is one transaction that updates the Card, inserts a Review, and updates the Question.
9. **Invariants in code, not the database.** There are no `CHECK` constraints and no `ON DELETE CASCADE`. Domain Schemas validate data in both directions, including rows read from the database. Deletes set `deleted_at`, and a delete use case soft-deletes children as explicit steps in its transaction. Repositories add `deleted_at IS NULL` in one place (a shared `live` SQL fragment), so handlers never think about it.

## Tech stack & dependency budget

### Backend (`be/`)

| Package | Why |
|---|---|
| `effect` | Core runtime, Schema, DateTime (IANA zones via Intl), FastCheck (re-exported) |
| `@effect/platform`, `@effect/platform-bun` | HttpApi server, multipart parsing, BunRuntime |
| `@effect/sql`, `@effect/sql-pg` | Typed SQL, connection pool, Migrator, transactions |
| `jose` | JWT sign and verify. It has zero dependencies and is audited; JWT handling is security code, so it is not hand-written |

That is **5 runtime dependencies**. Not included: an ORM, Zod, express or hono, a CSV library (an RFC 4180 parser is about 50 lines with tests), date-fns or luxon (Effect `DateTime` covers this), and an FSRS library (the scheduler is about 150 lines in the core domain).

### Frontend (`fe/`)

| Package | Why |
|---|---|
| `react`, `react-dom` (19) | UI |
| `@tanstack/react-router` (+ `@tanstack/router-plugin` dev) | Type-safe, file-based routing |
| `@tanstack/react-query` | Server state cache, refetch-on-focus for notifications |
| `effect`, `@effect/platform` | `HttpApiClient` generated from `@voca/contract`, plus Schema decoding |
| `vite`, `@vitejs/plugin-react` (dev) | Build |

**Design system: Washi Minimal.** The tokens and components are in [design-system.html](design-system.html). They become `fe/src/styles/tokens.css` (CSS custom properties) plus one CSS module per component. On hover, only a button's background changes, over 150 ms. Filled buttons fade to 60% (`color-mix(in srgb, <bg> 60%, transparent)`), and outlined buttons get a faint tint of their own color (ink 8%, danger 10%). Text and borders stay solid, other components keep their own hover, and nothing has a press animation.

Not included: a UI kit, Tailwind, a state manager, a form library, an audio library, or an ID or slug library. Styling uses plain CSS modules (built into Vite) and native `<dialog>`, `<details>`, and `<input type=file>` elements. Sound effects use the native Web Audio API ([05](05-study-sessions.md)). The slug generator (~15 lines) lives in `contract/` so both sides share it.

**Why not Foldkit:** it is still v0.x with breaking minor releases, a small community, and no React interop. Revisit it when it reaches 1.0. The TEA (Elm architecture) mindset can still be applied with React by keeping a `useReducer` per feature where state is non-trivial, such as the study session screen.

**Effect on the frontend:** it is used only for the contract client and Schema. React components stay plain. Effect adds about 30–40 KB gzipped, which is accepted in exchange for end-to-end typing with no code generation.

## Capacity plan ("thousands of users, small VM")

Assumptions: 2,000 DAU, 3 sessions per day, 15 answers per session.

That gives about 90k answers per day, or about 1 write per second on average and about 20 per second at peak.

| Resource | Budget |
|---|---|
| API pod | 1 replica, `requests: 100m CPU / 128Mi`, `limits: 512Mi`. Bun idles at about 50 MB |
| DB pool | 10 connections (`@effect/sql-pg` `maxConnections`) |
| Study request cost | Create session: ≤ 4 queries. Answer: 1 transaction with 3 statements |
| Storage | Review log ≈ 100 B per row → 90k rows/day ≈ 3 GB/year. Acceptable; partition by month when it exceeds 50M rows |

Rules that keep the service cheap:

- Every list endpoint uses keyset pagination.
- No N+1 queries. Bulk inserts use `unnest()`.
- Analytics are computed from indexed tables when requested.
- Nothing is cached in-process. Postgres is the cache.

## Configuration

Environment variables are read through Effect `Config`, so a missing variable fails at boot with a clear message:

```
DATABASE_URL, JWT_SECRET (≥32 bytes, base64), GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
WEB_ORIGIN (CORS allow-list, e.g. https://voca.pages.dev), PORT=3000, LOG_LEVEL=Info
```

## Cross-cutting

- **CORS:** allow only `WEB_ORIGIN`. Allowed headers: `Authorization` and `Content-Type`. No credentials, since there are no cookies.
- **Logging:** Effect `Logger.json` to stdout, with a request ID annotation. Tokens and CSV contents are never logged.
- **Rate limiting:** a Traefik `RateLimit` middleware on the ingress (platform feature), applied to `/auth/*` and the import endpoint. There is no rate limiting in the application.
- **Health:** `GET /healthz` returns `SELECT 1`. It is used for both the readiness and liveness probes.
