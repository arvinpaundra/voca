# Agent rules for Voca

Voca is a spaced-repetition vocabulary app. Bun workspaces: `contract/` (shared HTTP API + Schemas), `be/` (Bun + Effect API), `fe/` (React + TanStack + Vite). The specs live in `docs/`; decisions in `docs/13-decisions.md`.

## If you were given a task (a GitHub issue)

1. Work only in your own worktree and branch (named in the task).
2. Read the issue (`gh issue view <N>`), then the docs sections it lists under SPEC. Read the `locked` tests: they are the spec. Make them pass; never edit them.
3. Change only files matching the issue's `allow` globs. Never edit the issue itself.
4. Run the VERIFY command from the issue (`bun run verify --issue <N> --sha <sha>`) and repeat until it ends with `verify: all green`. Fix the first error first.
5. Commit, push, open a PR to `master` whose body says `Closes #<N>`, and reply with the issue's REPLY WITH list.

If the spec, the contract or a locked test looks wrong or contradictory, **stop and report it**. Don't work around it. `contract/`, `docs/`, `scripts/`, `lint/`, `.github/`, `.githooks/` and this file belong to the decision thread.

## Effect 4.1.2: don't trust your memory

Effect 4 renamed and moved many APIs, so names you remember from Effect 2/3 are often wrong. For example, `Effect.catchAll` doesn't exist; there is `Effect.catchTag`, `Effect.catchTags`, `Effect.catchCause` and others. Before using an API:
1. Copy the pattern from existing code in the same layer.
2. Otherwise read the type definitions: `be/node_modules/effect/dist/<Module>.d.ts` (`Effect`, `Layer`, `Schema`, …), `be/node_modules/effect/dist/http-api/`, `be/node_modules/effect/dist/sql/`.

Never guess a name; `bun run verify` will reject it at typecheck.

## Backend rules (docs/03, enforced by `bun run lint`)

- **No `throw`, `try/catch`, `async/await`, `new Promise`** in `be/` or `contract/`. Use `Effect.gen(function* () {...})`, `Effect.fail` with a `Data.TaggedError`, and `Effect.tryPromise` once at the infrastructure edge.
- **Layers per bounded context** (`be/src/<context>/`):
  - `domain/`: pure Schemas and functions; imports only `effect` and `@voca/contract`.
  - `application/`: use cases as `Effect.gen`, plus ports as `Context.Service`.
  - `infrastructure/`: implements the ports (`SqlClient`, Google, JWT).
  - `http/`: `HttpApiBuilder.group` handlers that call use cases.
- Invariants live in Schemas, not DB CHECKs. Slugs leave the server; bigint IDs never do.
- Tests are integration tests against real Postgres (Testcontainers; start Podman first with `podman machine start`).

## Frontend rules

- Call the API only through `HttpApiClient.make(VocaApi)` from `@voca/contract`. Never import `be/`.
- Access token in memory, refresh token in `localStorage` (`docs/08-auth.md`).

## Commands

| Command | What |
|---|---|
| `bun run verify [--issue N --sha S] [--fast]` | the gate: path guard, lint, typecheck, tests, fe build |
| `bun run lint` | ast-grep rules in `lint/` |
| `bun run typecheck` | all workspaces |
| `bun test` (inside `be/`, `fe/` or `contract/`) | that workspace's tests |
