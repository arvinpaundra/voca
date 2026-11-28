---
name: delete-comment
description: Voca comment cleanup. Remove code comments from a batch of files, tightening the no-comments ratchet (lint/comments.yml). Use when the owner says "/delete-comment [paths]" or asks to clean comments out of the codebase.
---

# /delete-comment [paths]

Voca bans code comments (`lint/comments.yml`, enforced by `bun run lint`). The ban is a **ratchet**: files already clean must stay clean; the rule's `ignores` list holds the files not yet cleaned. This skill cleans a batch of those files and drops them from the ignore list. It never relaxes the ratchet.

`paths`: the files or globs to clean this run. With none, pick the top of the `ignores` list in `lint/comments.yml` — prefer a whole directory so a reviewer sees one area at a time. Keep a run small enough to review (a directory, or ~150 comments).

Never touch: `**/*.test.ts`, `**/*.test.tsx`, `be/test/**` (locked tests are the spec), or `fe/src/routeTree.gen.ts` (generated). These are permanently exempt and are not in the ignore list.

## Loop

1. **Find the comments.** For each file, list its comment nodes:
   `bun x ast-grep scan --inline-rules 'id: c
   language: TypeScript
   severity: error
   message: c
   rule: { kind: comment }' <file>` (use `language: Tsx` for `.tsx`).

2. **Categorise every comment** into one bucket, and take its action:

   | Bucket | What it is | Action |
   |---|---|---|
   | **Tautology** | Repeats what the code already says (restates a signature, a type, the next line). Most JSDoc and module-top docstrings. | Delete the comment. |
   | **Stale** | Names code, a flag or a rollout that no longer exists, or duplicates a decision already in `docs/13-decisions.md`. | Delete the comment. |
   | **Excuse** | Justifies a hack, a shortcut, or a "temporary"/"for now"/"optional while the server rolls out" state. It lets a weak implementation survive. | Delete the comment **and** open a GitHub issue describing the hack to fix (`gh issue create`, label it, link the file and line). Do not fix the hack here. |
   | **Decision Record** | An important, non-obvious decision about the code: a concurrency invariant, a security trap, a why that the code genuinely cannot show, not already in an ADR. | Add a row to the ADR log in `docs/13-decisions.md` (next free number; Decision / Alternatives / Why), then delete the comment. One consolidated ADR per cohesive decision — do not spawn a tiny ADR per line. |

   When unsure between Tautology and Decision Record, it is almost always Tautology: the bar for an ADR is "a reviewer would get this wrong without it, and the code can't say it." A local clarification that isn't architectural is deleted, not promoted.

3. **Delete carefully.** `//` and `/* */` can appear inside strings and regexes (URLs like `https://…`, route patterns like `/^\/api\/…$/`). Do not strip with a blind regex. Edit each comment out, or rewrite the file preserving code exactly. An empty `catch {}` is fine with no body; never replace a comment with `/* empty */` (still a comment).

4. **Drop the cleaned files from the ratchet.** Remove each cleaned path from both `ignores` lists in `lint/comments.yml` (`.ts` under `no-comments`, `.tsx` under `no-comments-tsx`). Leave the permanent-exempt globs. Never add a path.

5. **Verify.**
   - `bun run lint` must be green (the rule now enforces the cleaned files).
   - `bun run typecheck` for any touched workspace; `bun test` for the touched workspace(s).
   - Re-run the ast-grep scan from step 1 on each cleaned file: it must report nothing.

6. **Commit** one logical change: `refactor(scope): drop comments from <area>`. If any Excuse issues were filed, list them in the PR body. Append the attribution lines the session requires.

## Estimate

To report how many lines are left to shed:
`bun x ast-grep scan --inline-rules 'id: c
language: TypeScript
severity: error
rule: { kind: comment }
message: c'` across the source (and the `Tsx` variant) counts remaining comment nodes; the ignore list in `lint/comments.yml` is the count of files still to clean.
