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
                 `bun run verify --print-locked <paths>` gives the `locked` lines; task issue created (limits block + DO);
                 `bun run verify --body draft.md --print-hash` gives the limits hash before the issue exists
3. dispatch    → `delegate_task` with `isolation: worktree` from the dispatch branch; implementer gets the message below (AGENTS.md is loaded automatically)
4. self-check  → implementer loops on `bun run verify --issue N --hash H` until green, opens a PR
5. re-check    → decision thread re-runs the same command in the worktree; checks the Definition of done below
6. fail        → failing output goes back to the same implementer; max 2 rounds,
                 then escalate the model tier on the same worktree
7. review      → reviewer reads diff + task + cited docs (never the implementer's summary);
                 blocking findings go back to the implementer, max 1 round
8. merge       → CI green → `bun scripts/merge-gate.ts <pr>`: `merge: ok` and the worker's report flags nothing → the decision thread
                 squash-merges and tells the owner; otherwise the owner merges. `Closes #N` closes the issue
```

**Stop and ask the user when:**
- a task needs a change to `contract/`, `docs/` or a locked test;
- Opus also fails verify;
- the reviewer and the tests disagree about what the spec means.

## Dispatch checklist

Before sending, from the dispatch branch:

1. **The branch holds everything the worker needs**: the current `scripts/verify.ts`, the reference code, the locked tests. Anything missing here fails the worker's gate for reasons it cannot fix. (Pilot 2 lost a round to this.)
2. Each `locked` entry is `path: hash` from `bun run verify --print-locked`, so a rebase never invalidates it.
3. The draft's VERIFY line carries the real limits hash before the issue is created (it sits outside the yaml block, so writing it doesn't change the hash); CI reads it from there. Issues are never edited after creation: the agent hook refuses it. Then `bun run verify --issue N --hash H` gets past `✓ path guard` (it fails later, on the red tests, which is expected).
4. The red tests are satisfiable: the full `bun run verify --issue N --hash H` (not only `bun test`: lint and typecheck too) is green against a throwaway implementation written the way the DO list says, which you then discard. (B1 lost a round: its test and its DO list each broke a lint rule.)
5. Every fact the task depends on is in the issue (pilot 2: the contract declares no not-found error for the endpoint, so the task said to use `Effect.orDie`).

Dispatch message (the same every time; the issue carries the content):

```
Do GitHub issue #N in the repo you are in (arvinpaundra/voca). The issue is the approved design: implement it now, no separate design round.
Your limits hash is H: your VERIFY command is `bun run verify --issue N --hash H`. (It is a hash of the issue's limits block, not a git commit.)
Read AGENTS.md first, then `gh issue view N`. Follow AGENTS.md exactly, including the commit and PR rules. Do not edit the issue.
Reply with the issue's REPLY WITH list.
```

If the worker reports a blocker, fix the cause yourself (it is usually the dispatch), then send it the corrected hash through the same thread; do not count that as a failed round.

## Definition of done

A task is done when all of these hold. The evidence comes from tools, never from the worker's description.

1. `verify` is green in CI on the PR, and the PR is linked to its task issue (so the path guard ran).
2. Every DO item maps to a file and a test; the worker's reply lists the mapping.
3. The locked tests are unchanged (the guard checks their content), and behaviour the worker added has its own test.
4. No stub is left for the task's endpoints or components: `grep -rn "not implemented"` over the allowed paths is empty.
5. **UI tasks:** the issue's DONE line names the screenshots. At re-check the dispatcher runs `bun scripts/shots.ts <specs>` on the worker's branch and gives the image paths to the owner, who judges the visuals. No model views them. Default: one desktop shot per changed state; add `:390` for layout changes and `:dark` for style changes.

Backend tasks need no screenshots or captured responses: the integration tests assert status, shape and values against real Postgres. Put an example response in the PR only when it helps review, printed by a test run, never typed.

## Merging

The decision thread may merge a PR itself only when `bun scripts/merge-gate.ts <pr>` prints `merge: ok` **and** the worker's report flags nothing (no "couldn't do", no deviation, no gap). The gate checks:

1. CI `verify` green on the current head, and the branch not behind master.
2. A task PR is linked to its task issue, so CI ran the path guard (the dispatcher checks this at re-check).
3. No critical path: `contract/`, `be/migrations/`, `be/src/identity/` (auth), `be/src/shared/`, `lint/`, `scripts/`, `.github/`, `.githooks/`, `.claude/`, `AGENTS.md`, `docs/13-decisions.md`, any `package.json`, `bun.lock`.
4. Small: at most 8 files and 300 changed lines, the task's locked tests not counted.

Then: `gh pr merge <pr> --squash --delete-branch`, clean up the worktree, and tell the owner which PR was merged and why it qualified. Anything else waits for the owner, with the gate's reasons in a PR comment. Workers never merge.

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
