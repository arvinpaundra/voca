---
# Read by `bun run verify --task tasks/<id>.md`. Written by the decision thread only.
scope: be                       # be | fe | be,fe
allow:                          # globs the worker may change; everything else fails the path guard
  - be/src/identity/**
locked:                         # tests written red by the decision thread; any change fails
  - be/test/auth.test.ts
---

TASK <id>: <one-line goal>
MODEL: haiku → sonnet → opus (escalate after 2 failed verify rounds)
WHY: <decision # in docs/13-decisions.md, or "new decision, added as #N">
SPEC: <docs/NN-*.md sections to follow>
CONTRACT: <contract/src/*.ts files relied on>
BRANCH: feat/<name> from master, in its own worktree. Open a PR to master when done.
REFERENCE: <existing files to copy the pattern from>
DO:
- <node: endpoint X returns Y / use case Z does W>
DON'T: anything outside `allow`. Never edit contract/, docs/, tasks/ or locked tests; report if they look wrong.
VERIFY: bun run verify --task tasks/<id>.md
REPLY WITH: files changed + the last 20 lines of VERIFY output + PR URL + anything you couldn't do
