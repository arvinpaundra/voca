# Agent rules for Voca

Voca is a spaced-repetition vocabulary app. Bun workspaces: `contract/` (shared HTTP API + Schemas), `be/` (Bun + Effect API), `fe/` (React + TanStack + Vite). The specs live in `docs/`; decisions in `docs/13-decisions.md`.

## If you were given a task (a GitHub issue)

1. Work only in your own worktree and branch (named in the task).
2. Read the issue (`gh issue view <N>`), then the docs sections it lists under SPEC. Read the `locked` tests: they are the spec. Make them pass; never edit them.
3. Change only files matching the issue's `allow` globs. Never edit the issue itself.
4. Run the VERIFY command from the issue (`bun run verify --issue <N> --hash <hash>`; the hash is the limits hash from your task message, not a git commit) and repeat until it ends with `verify: all green`. Fix the first error first.
5. Commit, push, open a PR to `master` whose body says `Closes #<N>`, and reply with the issue's REPLY WITH list.

If the spec, the contract or a locked test looks wrong or contradictory, **stop and report it**. Don't work around it. `contract/`, `docs/`, `scripts/`, `lint/`, `.github/`, `.githooks/` and this file belong to the decision thread.

## Trunk-based development

`master` is the trunk: always green and releasable. There is no `develop` or release branch.

- Branches are short-lived (merged within a day or two) and small: one issue, one PR, reviewable in minutes. Split anything bigger into steps that each merge on their own.
- Rebase on `master` before opening the PR and before merging; never merge `master` into a branch. Squash-merge, then delete the branch.
- Merge only with CI green. If `master` breaks, revert first and fix forward after.
- Unfinished work still merges: keep it unreachable (not wired in, or behind a flag) and leave `master` working.
- Contract changes are additive first: add the new shape, migrate FE and BE, then remove the old one in a later PR, so `be/` and `fe/` never break each other mid-way.

## Commits and PRs

- Commit header `type(scope): subject` (Conventional Commits); the body says why. No attribution (`Co-authored-by`, "Generated with").
- One logical change per commit; no WIP commits.
- Never `--no-verify`, never amend after pushing, never push to `master`, never commit `.env` or secrets.
- Workers never force-push. The decision thread may `git push --force-with-lease` a PR branch it has rebased onto `master` (a stacked PR after a squash merge); never plain `--force`.
- Branch `<type>/<name>` from the latest `master`.
- `.claude/hooks/guard.ts` refuses the never-rules above, plus editing issues and writes through `gh api`, before the command runs. If it blocks you, don't work around it: report it.
- Workers never merge. The decision thread merges a PR itself only when `scripts/merge-gate.ts` passes (docs/agents/loop.md "Merging"); otherwise the owner merges.
- The dispatcher picks the model and escalates (Haiku, then Sonnet, then Opus after 2 failed verify rounds). Workers never switch models.
- PR title `[Type] Title`, e.g. `[Feat] Add token refresh to the auth flow` (squash merges make it the commit on `master`). Use `.github/pull_request_template.md` as a guide. A task PR links its issue (`Closes #<issue>` in the body): CI finds it through GitHub's linked issues and runs the path guard. `gh pr create --assignee @me`.

## Effect 4.1.2: don't trust your memory

Effect 4 renamed and moved many APIs, so names you remember from Effect 2/3 are often wrong (`Effect.catchAll` doesn't exist). Before using an API, in this order:
1. Copy the pattern from the reference slice: `be/src/identity/**` and `be/test/me.test.ts`.
2. Read [`docs/agents/effect-cheatsheet.md`](docs/agents/effect-cheatsheet.md).
3. Read Effect's own docs, shipped in the package: `be/node_modules/effect/AGENTS.md` and `be/node_modules/effect/ai-docs/src/` (runnable examples: HTTP API, SQL, testing, layers).
4. Read the types: `be/node_modules/effect/dist/<Module>.d.ts`.

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

- Call the API only through `callApi` in `fe/src/lib/api.ts` (the typed `HttpApiClient` for `VocaApi`); copy its use from `fe/src/lib/api.test.ts`. Never import `be/`.
- Access token in memory, refresh token in `localStorage` (`docs/08-auth.md`).

## Commands

| Command | What |
|---|---|
| `bun run verify [--issue N --hash H] [--fast]` | the gate: path guard, lint, typecheck, tests, fe build |
| `bun run lint` | ast-grep rules in `lint/` |
| `bun run typecheck` | all workspaces |
| `bun test` (inside `be/`, `fe/` or `contract/`) | that workspace's tests |
