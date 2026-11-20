# Agent rules for Voca

Voca is a spaced-repetition vocabulary app. Bun workspaces: `contract/` (shared HTTP API + Schemas), `be/` (Bun + Effect API), `fe/` (React + TanStack + Vite). Specs live in `docs/`. The decision thread's process (dispatch, merging, trunk rules) is in `docs/agents/loop.md`.

## If you were given a task (a GitHub issue)

1. In your worktree, run `bun install --frozen-lockfile`, then create your branch from the dispatch commit named in your task message (`git switch -c <branch> <commit>`), never from `master`.
2. Read the issue (`gh issue view <N>`) and its context pack. Read the `locked` tests: they are the spec. Make them pass; never edit them.
3. **Fail fast:** run the locked tests before writing code. Every failure must come from your own stubs (`not implemented: <your task>`). If one fails for any other reason (a 401, another task's stub, a wrong expectation), stop and reply `disputed: <test>: <why>`.
4. Change only files matching the issue's `allow` globs. Never edit the issue.
5. Run the VERIFY command from the issue (`bun run verify --issue <N> --hash <hash>`, where the hash is the limits hash from your task message) until it ends with `verify: all green`. Fix the first error first. Write logs to `/tmp`, never into the repo. VERIFY includes diff coverage: at least 90% of the lines you add in `be/src` and `fe/src/lib` must run in a test. An uncovered line means a missing test; never weaken or skip a test to pass it.
6. Commit, push, and open a PR to `master`: title `[Type] Title`, body following `.github/pull_request_template.md` with `Closes #<N>`, and `gh pr create --assignee @me`. Reply with `{pr, green, disputed, couldNotDo}`.
7. Your PR stays yours until it merges. Findings come back to you: a CI failure, a conflict with `master`, the owner's review (`gh pr view <PR> --comments`). Fix them on the same branch, run VERIFY, and push; after a rebase onto `master`, push with `--force-with-lease`. If a finding looks wrong, reply `disputed: …` instead of working around it. If the same check fails 3 rounds in a row, stop and report.

If the spec, the contract or a locked test looks wrong, **stop and report it**. `docs/01-functional-requirements.md` belongs to the product role; the rest of `docs/`, and `contract/`, `scripts/`, `lint/`, `.github/`, `.githooks/`, `.claude/` and this file belong to the decision thread.

## Code and commits

- Write for the reviewer: a blank line between logical steps, one statement per line, and long argument lists, objects, chains and conditions broken across lines.
- Comments say what the code can't: why, an invariant, a trap. Never point to docs (a `docs/` path, a section name, an ADR or FR number).
- Commit message: the header only, `type(scope): subject`. One logical change per commit. No attribution.
- Never `--no-verify`, never plain `--force`, never push to `master`, never merge, never edit an issue, never commit `.env` or secrets. `.claude/hooks/guard.ts` refuses these; if it blocks you, report it.

## Effect 4.1.2: don't trust your memory

Names you remember from Effect 2/3 are often wrong (`Effect.catchAll` doesn't exist). Before using an API:
1. Copy the pattern from the reference slice: `be/src/identity/**` and `be/test/me.test.ts`.
2. Read `docs/agents/effect-cheatsheet.md`.
3. Read Effect's own docs: `be/node_modules/effect/AGENTS.md` and `be/node_modules/effect/ai-docs/src/`.
4. Read the types: `be/node_modules/effect/dist/<Module>.d.ts`.

## Backend rules (enforced by `bun run lint`)

- **No `throw`, `try/catch`, `async/await`, `new Promise`** in `be/src` or `contract/src`. Use `Effect.gen`, `Effect.fail` with a `Data.TaggedError`, and `Effect.tryPromise` once at the infrastructure edge.
- **Layers per bounded context** (`be/src/<context>/`): `domain/` pure Schemas and functions (imports only `effect` and `@voca/contract`); `application/` use cases and ports (`Context.Service`); `infrastructure/` implements the ports; `http/` handlers that call use cases.
- SQL only as a `sql`-tagged template (values are bound placeholders; identifiers through `sql(name)`). Never `.unsafe(…)` or `.literal(…)`.
- Invariants live in Schemas, not DB CHECKs. Slugs leave the server; bigint IDs never do.
- Tests are integration tests against real Postgres (Testcontainers; on macOS start Podman first with `podman machine start`).

## Frontend rules

- Call the API only through the session (`fe/src/lib/appSession.ts`) or `callApi` in `fe/src/lib/api.ts`. Never import `be/`.
- Access token in memory, refresh token in `localStorage`.

## Commands

| Command | What |
|---|---|
| `bun run verify [--issue N --hash H] [--fast]` | the gate: path guard, lint, typecheck, tests, fe build |
| `bun run lint` / `bun run typecheck` | ast-grep rules / all workspaces |
| `bun test` (inside `be/`, `fe/` or `contract/`) | that workspace's tests |
