---
name: feature
description: Voca decision-thread playbook. Turn one feature from the docs into merged code through the agent loop (split, locked tests, pre-check, task issues, the agent-loop workflow, CI re-check), spending as few tokens as possible. Use when the owner says "/feature <name>" or asks to build the next feature.
---

# /feature <name>

You are the decision thread for Voca. You decide, specify and verify; workers implement. Read `docs/agents/loop.md` once at the start: it is the process and the cost rules. Workers follow `AGENTS.md`, which they load themselves.

**You never implement feature code.** You write decisions, locked tests and stubs; everything else is a task.

## 1. Understand and split (stop for the owner's approval)

- Read only the docs the feature needs (its FRs in `docs/01-functional-requirements.md`, the relevant sections of `docs/07-api.md`, `docs/06-data-model.md`, and the topic doc), plus the contract files it touches.
- Split into **cohesive tasks: one per bounded context per side**, with disjoint `allow` lists. A task's tests must never need another task's code: seed data with SQL in tests instead of calling another task's endpoints.
- Present the split (tasks, files each owns, what each locked test pins down) and wait for the owner's go. Any decision the docs don't settle goes to the owner first, then into `docs/13-decisions.md`.

## 2. Locked tests and stubs

- One dispatch branch per task from the latest `master`: `dispatch/<task>`.
- Write the locked tests in the style of `be/test/me.test.ts` (backend, through `be/test/identity.ts`) or `fe/src/lib/*.test.ts` (frontend). Blank lines between steps; no doc references in comments.
- Stubs make the tests compile. Every stub fails or returns with the task's marker: `Effect.die("not implemented: <TASK>")`, `Promise.reject(new Error("not implemented: <TASK>"))`, or a return value containing `not implemented: <TASK>`.
- Shared wiring that several tasks would edit means the split is wrong; merge those tasks.
- Search the existing tests for every endpoint the task builds (`grep -rn "/api/<path>" be/test fe/src`). A test that expects it unbuilt (a 500 probe, say) breaks once it's built: point that test elsewhere on master before dispatch. The pre-check runs only the locked tests, so it can't catch this.

## 3. Pre-check (instead of a throwaway implementation)

```
bun scripts/precheck.ts <TASK> <locked test files>
bun run verify --scope <be|fe>        # typecheck and lint of the stubs and tests
```

The pre-check must print `✓`. Every failure has to be the task's own stub; a 401, another task's stub or a wrong expectation means fix the tests or the split before going on.

## 4. Task issues

For each task: `bun scripts/verify.ts --print-locked <file> --print-locked <file>` (the flag once per file), then a draft issue body:

````
```yaml
scope: be|fe
allow:
  - <globs>
locked:
  <path>: <content hash>
```

WHY / SPEC / CONTRACT: one line each
CONTEXT PACK: the exact files to read (the reference to copy, the stubs to fill), and the 10-20 spec lines that matter, pasted
DO: the nodes to implement, one per bullet
DON'T: outside `allow`; contract/, docs/, locked tests
VERIFY: bun run verify --issue <this issue> --hash HASH
````

Then `H=$(bun scripts/verify.ts --body draft.md --print-hash)`, write `H` on the VERIFY line, and `gh issue create --label task --body-file draft.md`. Never edit an issue after creating it. Check `bun scripts/verify.ts --issue N --hash H --fast` prints `✓ path guard` on the dispatch branch.

## 5. Run the workflow

Only after the owner says "use a workflow" (or "run the agent-loop workflow"). Then call the saved `agent-loop` workflow:

```
{ tasks: [{ issue, hash, base: <dispatch commit sha>, branch: "feat/<feature>-<task>", title,
            model: "haiku", effort: "low" | "medium" | "high" }] }
```

Every agent gets an explicit model: workers start on Haiku. Never Opus for routine work, review or re-check. `effort: "low"` for small mechanical tasks, `"high"` only for tricky logic. If the owner set a time limit, start a background `sleep <seconds>` timer and stop the workflow when it fires.

## 6. Re-check, heal, report

```
bun scripts/recheck.ts <PR numbers>
```

- `✓`: CI is green with the path guard and no stub is left.
- A `disputed` reply: check it. If the worker is right, fix the test or the split (new issue, new hash) and tell the owner.
- A failing PR: run `agent-loop` with `{ heals: [{ issue, hash, pr, branch, worktree, finding, files, model: "haiku" }] }`, one narrow round each. After 2 failed rounds on the same finding, use `model: "sonnet"`.
- UI tasks: `bun scripts/shots.ts <specs>` on the PR's branch, and give the owner the paths.
- `bun scripts/merge-gate.ts <pr>`: merge it yourself only on `merge: ok` with a clean reply; otherwise the owner merges.
- Report to the owner: one line per task (PR, state), the disputes, and what waits for them.

## 7. After the feature

- Remove merged worktrees and branches.
- Add the Effect idioms workers had to discover to `docs/agents/effect-cheatsheet.md`.
- A finding the owner made that could recur becomes a lint rule or an `AGENTS.md` line.
