# Agent loop

How the decision thread turns a decision into merged code using cheap implementer models. The worker rules are in [`AGENTS.md`](../../AGENTS.md).

## Roles

| Role | Model | Owns |
|---|---|---|
| Decision thread | Opus | `docs/`, `contract/`, task issues, locked tests, reference code, `scripts/`, `lint/` |
| Implementer | Haiku first, then Sonnet, then Opus | the files in its task's `allow` list |
| Reviewer | Sonnet or Opus, never the implementer's model | read-only |

Each task runs in a fresh child (`delegate_task`) in its own worktree, so the worker starts with no stale context.

## Loop

```
1. decision    → ADR / contract change committed to master
2. spec        → locked tests written red on a local dispatch branch (never master, so master stays green);
                 its HEAD is the limits block's `base`; task issue created (limits block + DO);
                 `bun run verify --issue N --print-hash` gives the limits hash
3. dispatch    → `delegate_task` with `isolation: worktree` from the dispatch branch; implementer gets the message below (AGENTS.md is loaded automatically)
4. self-check  → implementer loops on `bun run verify --issue N --hash H` until green, opens a PR
5. re-check    → decision thread re-runs the same command in the worktree; compares the diff against DO
6. fail        → failing output goes back to the same implementer; max 2 rounds,
                 then escalate the model tier on the same worktree
7. review      → reviewer reads diff + task + cited docs (never the implementer's summary);
                 blocking findings go back to the implementer, max 1 round
8. merge       → CI green → the user merges; `Closes #N` closes the issue, so nothing accumulates
```

**Stop and ask the user when:**
- a task needs a change to `contract/`, `docs/` or a locked test;
- Opus also fails verify;
- the reviewer and the tests disagree about what the spec means.

## Dispatch checklist

Before sending, from the dispatch branch:

1. **The branch holds everything the worker needs**: the current `scripts/verify.ts` (with `base` support), the reference code, the locked tests. Anything missing here fails the worker's gate for reasons it cannot fix. (Pilot 2 lost a round to this.)
2. The issue's `base` is the full sha of the dispatch branch's HEAD, the commit with the locked tests.
3. `bun run verify --issue N --print-hash` works from that branch, and `bun run verify --issue N --hash H` gets past `✓ path guard` (it fails later, on the red tests, which is expected).
4. The red tests are satisfiable: they pass against a throwaway implementation that you then discard.
5. Every fact the task depends on is in the issue (pilot 2: the contract declares no not-found error for the endpoint, so the task said to use `Effect.orDie`).

Dispatch message (the same every time; the issue carries the content):

```
Do GitHub issue #N in the repo you are in (arvinpaundra/voca). The issue is the approved design: implement it now, no separate design round.
Your limits hash is H: your VERIFY command is `bun run verify --issue N --hash H`. (It is a hash of the issue's limits block, not a git commit.)
Read AGENTS.md first, then `gh issue view N`. Follow AGENTS.md exactly, including the commit and PR rules. Do not edit the issue.
Reply with the issue's REPLY WITH list.
```

If the worker reports a blocker, fix the cause yourself (it is usually the dispatch), then send it the corrected hash through the same thread; do not count that as a failed round.

## Task sizing

- One use case, endpoint or component per task, about 5 files.
- The issue's limits block is hash-checked: the worker can't widen `allow`/`locked` without verify failing.
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
