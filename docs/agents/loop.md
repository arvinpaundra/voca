# Agent loop

How the decision thread turns a decision into merged code using cheap implementer models. The worker rules are in [`AGENTS.md`](../../AGENTS.md).

## Roles

| Role | Model | Owns |
|---|---|---|
| Decision thread | Opus | `docs/`, `contract/`, `tasks/`, locked tests, reference code, `scripts/`, `lint/` |
| Implementer | Haiku first, then Sonnet, then Opus | the files in its task's `allow` list |
| Reviewer | Sonnet or Opus, never the implementer's model | read-only |

Each task runs in a fresh child (`delegate_task`) in its own worktree, so the worker starts with no stale context.

## Loop

```
1. decision    → ADR / contract change committed to master
2. spec        → locked tests written red + tasks/<id>.md (allow, locked, DO) committed to master
3. dispatch    → implementer gets "do tasks/<id>.md" (AGENTS.md is loaded automatically)
4. self-check  → implementer loops on `bun run verify --task tasks/<id>.md` until green, opens a PR
5. re-check    → decision thread re-runs the same command in the worktree; compares the diff against DO
6. fail        → failing output goes back to the same implementer; max 2 rounds,
                 then escalate the model tier on the same worktree
7. review      → reviewer reads diff + task + cited docs (never the implementer's summary);
                 blocking findings go back to the implementer, max 1 round
8. merge       → CI green → the user merges
```

**Stop and ask the user when:**
- a task needs a change to `contract/`, `docs/` or a locked test;
- Opus also fails verify;
- the reviewer and the tests disagree about what the spec means.

## Task sizing

- One use case, endpoint or component per task, about 5 files.
- Red tests first: a task whose behaviour has no locked test is not ready to dispatch.
- Name the reference files to copy. Without one, the first task in a new area goes to Sonnet or Opus.

## What each gate catches

| Gate | Catches |
|---|---|
| path guard | edits outside `allow`, weakened tests, contract/docs edits |
| lint (`lint/*.yml`) | throw/try/async, layer and cross-package imports |
| typecheck | contract mismatches, missing handlers (`HttpApiBuilder` requires every endpoint), invented Effect APIs |
| tests | behaviour against the spec |
| reviewer | hardcoded answers that only satisfy the tests, spec intent the tests miss |
