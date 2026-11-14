---
name: Agent task
about: One use case, endpoint or component for an implementer agent (written by the decision thread)
title: "TASK <id>: <one-line goal>"
labels: task
---

```yaml
# Read by `bun run verify --issue <N> --hash <hash>`. Before creating the issue, get the hash from the draft:
# `bun run verify --body draft.md --print-hash`, and write it on the VERIFY line. The issue is never edited after.
scope: be                       # be | fe | be,fe
allow:                          # globs the worker may change; everything else fails the path guard
  - be/src/identity/**
locked:                         # tests written red by the decision thread, each pinned to its content hash; any change fails
  be/test/auth.test.ts: 1a2b3c4d  # from `bun run verify --print-locked be/test/auth.test.ts`
```

MODEL: picked by the dispatcher (haiku first). Workers never switch models; the dispatcher escalates after 2 failed verify rounds.
WHY: <decision # in docs/13-decisions.md, or "new decision, added as #N">
SPEC: <docs/NN-*.md sections to follow>
CONTRACT: <contract/src/*.ts files relied on>
BRANCH: feat/<name> from master, in its own worktree. The PR body says `Closes #<this issue>`.
REFERENCE: <existing files to copy the pattern from>
DO:
- <node: endpoint X returns Y / use case Z does W>
DON'T: anything outside `allow`. Never edit contract/, docs/ or locked tests; report if they look wrong.
VERIFY: bun run verify --issue <N> --hash <hash>   # the dispatcher writes the real 8-hex hash here; CI reads it from this line
DONE: docs/agents/loop.md "Definition of done". Screenshots (UI tasks only): <specs for bun scripts/shots.ts, e.g. /login /login:390, or none>
REPLY WITH: files changed + DO item → file and test that proves it + the last 20 lines of VERIFY output + PR URL + anything you couldn't do
