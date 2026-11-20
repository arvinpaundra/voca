---
name: feature
description: Voca decision-thread playbook. Turn one feature from the docs into merged code through the agent loop (split, locked tests, pre-check, task issues, dispatch to fresh worker sessions, routing and repair), spending as few tokens as possible. Use when the owner says "/feature FR-<id>" or asks to build the next feature.
---

# /feature FR-<id>

The FR code (e.g. `FR-4`) names everything for this feature; below, `<fr>` is its lower-case form (`fr-4`): the dispatch folder `/tmp/dispatch/<fr>/`, the dispatch branches `dispatch/<fr>-<task>` and the task branches `feat/<fr>-<task>`.

You are the decision thread for Voca, in the architect role: the product role (`/product`) has already decided what to build. You decide how, specify and verify; workers implement. Read `docs/agents/loop.md` once at the start: it is the process and the cost rules. Workers follow `AGENTS.md`, which they load themselves.

**You never implement feature code.** You write decisions, locked tests and stubs; everything else is a task.

## 1. Understand and split (stop for the owner's approval)

- Start from `FR-<id>` in `docs/01-functional-requirements.md`, approved. Missing or ambiguous → stop and ask the owner to run `/product FR-<id>` first; never write or rewrite requirements yourself.
- Read only the docs the feature needs (its FRs in `docs/01-functional-requirements.md`, the relevant sections of `docs/07-api.md`, `docs/06-data-model.md`, and the topic doc), plus the contract files it touches.
- Split into **cohesive tasks: one per bounded context per side**, with disjoint `allow` lists. A task's tests must never need another task's code: seed data with SQL in tests instead of calling another task's endpoints.
- Present the split (tasks, files each owns, what each locked test pins down) with a table mapping every acceptance criterion of the FR to its locked test(s), and wait for the owner's go. A criterion with no test is a gap in the split. Any decision the docs don't settle goes to the owner first, then into `docs/13-decisions.md`.

## 2. Locked tests and stubs

- One dispatch branch per task from the latest `master`: `dispatch/<fr>-<task>`.
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

## 5. Dispatch

After the owner's go on the split. Write `/tmp/dispatch/<fr>/tasks.json`:

```
{ "feature": "<fr>",
  "tasks": [{ "issue": N, "hash": "H", "base": "<dispatch commit sha>", "branch": "feat/<fr>-<task>", "title": "…" }] }
```

Run `bun scripts/dispatch.ts /tmp/dispatch/<fr>/tasks.json` as a **background** command and wait for it to finish (`t3_background_wait`); don't poll it. It creates each task's worktree on its branch, installs dependencies, and starts one fresh headless implementer session per task (`.claude/agents/implementer.md`, Haiku, project settings only), all in parallel. It prints one line per task; replies land in `/tmp/dispatch/<fr>/replies/`.

## 6. Route, repair, report

```
bun scripts/next.ts --feature <fr> <PR numbers>
```

It decides every PR by rule and prints them grouped:

| Group | What it means | You |
|---|---|---|
| `wait` | CI still running | run `next.ts` again once CI is done |
| `owner` | a `disputed` or `couldNotDo` reply, critical paths, over 8 files / 300 lines, a PR not linked to its task | a dispute: check it; if the worker is right, fix the test or the split (new issue, new hash). The rest: tell the owner |
| `heal` | red CI (its first error), a conflict, stubs left | run the printed `bun scripts/dispatch.ts …/heals.json` in the background, then `next.ts` again |
| `stopped` | 4 repair rounds failed (haiku, haiku, sonnet, opus) | tell the owner |
| `rebase` | only behind master: `next.ts` already ran `gh pr update-branch --rebase` | run `next.ts` again once CI is done |
| `merge` | green, small, no critical path, clean reply | merge it |

There is no review agent: VERIFY's diff coverage and the locked tests pin the behaviour, and the owner reviews what `next.ts` sends them. For the owner's own review comments, write a `heals.json` by hand (finding: "Address every comment: `gh pr view P --comments`") and dispatch it.

- UI tasks: on the PR's branch, `bun scripts/shots.ts --mock <specs>` and `bun scripts/shots.ts --design`; compare each page with its design screen, send every mismatch as a heal, then give the owner both sets of paths.
- Report to the owner: one line per task (PR, group), the disputes, and what waits for them.

## 7. After the feature

- Remove merged worktrees and branches, and `/tmp/dispatch/<fr>/`.
- Add the Effect idioms workers had to discover to `docs/agents/effect-cheatsheet.md`.
- A finding the owner made that could recur becomes a lint rule or an `AGENTS.md` line.
