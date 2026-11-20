# Agent loop

How the decision thread turns a feature into merged code with cheap implementer models, spending as few tokens as possible. Workers follow [`AGENTS.md`](../../AGENTS.md). A fresh session defines the requirement with `/product <goal>` (`.claude/skills/product/SKILL.md`); another fresh session runs the rest with `/feature <name>` (`.claude/skills/feature/SKILL.md`).

## Roles

| Role | Model | Owns |
|---|---|---|
| Product | the session's model, in a **fresh session per goal** | what to build and why: `docs/01-functional-requirements.md` (goal, behaviour, acceptance criteria, priority). Never the how |
| Decision thread (architect) | the session's model, in a **fresh session per feature** | how to build it: decisions, the rest of `docs/`, `contract/`, task issues, locked tests and stubs, `scripts/`, `lint/`, `.claude/`. Never rewrites an FR |
| Worker | Haiku; Sonnet after 2 failed rounds; Opus last | the files in its task's `allow` list |
| Re-check | **no agent**: CI plus one shell command | |
| Review | the owner | |

Never use Opus for review or re-check. Every workflow agent gets an explicit `model` and `effort`.

## Loop

```
0. product    → `/product`: the FR with its acceptance criteria, approved by the owner and merged; the handoff to the architect
1. decision   → ADR / contract change committed to master
2. split      → every acceptance criterion maps to a locked test; cohesive tasks: one per bounded context per side (e.g. library backend, library frontend), with disjoint `allow` lists;
                no task's tests may need another task's code
3. spec       → locked tests + stubs on one dispatch branch per task. Every stub fails with `not implemented: <TASK>`
4. pre-check  → `bun scripts/precheck.ts <TASK> <locked test files>`: red, and every failure is the task's own stub
5. issues     → limits block + context pack; `verify --body draft.md --print-hash`, hash on the VERIFY line, created once
6. workflow   → the saved `agent-loop` workflow with the task list: one worker per task, explicit model and effort, own worktree
7. re-check   → `bun scripts/recheck.ts <PR…>`: CI green with the path guard, no stubs left in the task's files
8. review     → the owner reviews; every finding goes back to the worker that wrote the code ("Self-healing")
9. merge      → `bun scripts/merge-gate.ts <pr>` says `merge: ok` and the reply flags nothing → the decision thread merges;
                otherwise the owner merges. `Closes #N` closes the issue. Then remove the worktree and branch
```

**Stop and ask the owner when:** a task needs a change to `contract/`, `docs/` or a locked test; a worker replies `disputed: …`; Opus also fails.

## Spending few tokens

| Lever | Rule |
|---|---|
| Fewer cold starts | Cohesive tasks, not one per endpoint. A worker's fixed cost (rules, issue, reference files) is paid once per task. |
| No wasted runs | Pre-check before dispatch; workers fail fast on their locked tests before writing code. |
| Small context | The issue's **context pack** lists the exact files to read and pastes the 10–20 spec lines that matter, instead of whole docs. |
| Cheap models | Haiku workers; `effort: low` for small mechanical tasks, `high` only for tricky logic. |
| No duplicate verification | CI is the independent re-check; the decision thread reads it with a script, not an agent. |
| Small replies | Workers reply `{pr, green, disputed, couldNotDo}`. |
| Narrow heals | A heal gets only the finding and the 2–3 files involved. |
| Learning once | After each feature, add the Effect idioms workers had to discover to `effect-cheatsheet.md`. |
| Short decision thread | One fresh session per feature; mechanical steps batched into scripts. |

## Pre-check

Run the locked tests of a task against its stubs before creating its issue:

```
bun scripts/precheck.ts LB be/test/decks.test.ts be/test/words.test.ts
```

It passes only when at least one test fails and every failure mentions `not implemented: LB`. A 401, another task's stub, or a wrong expectation fails the pre-check: the tests or the split are wrong. This replaces writing a throwaway implementation.

## Issue body

The limits block (yaml: `scope`, `allow`, `locked` as `path: content hash`) followed by:

```
WHY / SPEC / CONTRACT
CONTEXT PACK: the files to read, and the spec lines that matter, pasted
DO: the nodes to implement
DON'T: outside `allow`; contract/, docs/, locked tests
VERIFY: bun run verify --issue <this issue> --hash <hash>
```

## Self-healing

The decision thread never edits or pushes to a worker's branch. Findings go to the worker that wrote the code; in a workflow, a heal agent gets the finding, the worktree and the 2–3 files involved.

| Finding | Message |
|---|---|
| CI fails | "CI fails on PR #P: <first error>. Fix it on your branch, run VERIFY again, push." |
| conflict with `master` | "PR #P conflicts with master. Rebase onto `origin/master`, run VERIFY again, push with `--force-with-lease`." |
| the owner's review | "The owner reviewed PR #P. Address every comment (`gh pr view P --comments`), run VERIFY again, push." |

After 2 failed rounds on the same finding, move the task to the next model tier. A finding the owner makes that could recur becomes a rule: a lint rule when mechanical, an `AGENTS.md` line when it needs judgment.

## Definition of done

1. CI `verify` is green on the PR and ran the path guard (the PR is linked to its task issue).
2. The locked tests are unchanged, and behaviour the worker added has its own test.
3. No `not implemented: <TASK>` stub is left in the task's files.
4. **UI tasks:** the issue names the screenshots. On the PR's branch the decision thread runs `bun scripts/shots.ts --mock <specs>` (signed-in pages against the design's sample data) and `bun scripts/shots.ts --design`, compares each page with its design screen, and sends every mismatch back to the worker before the owner sees the PR. Then it gives the owner both sets of paths.

## Merging and branches

- `master` is the trunk: always green. Branches are short-lived, one issue per PR, squash-merged, then deleted. Merge only with CI green; if `master` breaks, revert first.
- Unfinished work still merges, unreachable (not wired in, or behind a flag). Contract changes are additive first: add, migrate both sides, remove later.
- The decision thread merges a PR itself only when `bun scripts/merge-gate.ts <pr>` prints `merge: ok` and the worker's reply flags nothing. Critical paths (`contract/`, `be/migrations/`, `be/src/identity/`, `be/src/shared/`, `lint/`, `scripts/`, `.github/`, `.githooks/`, `.claude/`, `AGENTS.md`, `docs/13-decisions.md`, `package.json`, `bun.lock`) and PRs over 8 files or 300 lines wait for the owner.
- The decision thread may `git push --force-with-lease` a stacked PR it rebased; never plain `--force`.

## What each gate catches

| Gate | Catches |
|---|---|
| pre-check | tests that can't pass, cross-task dependencies |
| path guard | edits outside `allow`, weakened tests |
| lint | throw/try/async, layer imports, raw SQL |
| typecheck | contract mismatches, missing handlers, invented Effect APIs |
| tests | behaviour against the spec |
| the owner's review | spec intent the tests miss, anything no rule covers yet |
