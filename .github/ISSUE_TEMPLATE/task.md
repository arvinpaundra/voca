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

WHY: <one line: the decision or FR behind this task>
SPEC: <docs sections, for reference only>
CONTRACT: <contract/src/*.ts files relied on>
CONTEXT PACK:
- read: <the reference file to copy> , <the stubs to fill>
- spec lines that matter (pasted, 10-20 lines):
  > ...
DO:
- <node: endpoint X returns Y / use case Z does W>
DON'T: anything outside `allow`. Never edit contract/, docs/ or locked tests; report if they look wrong.
VERIFY: bun run verify --issue <N> --hash <hash>   # the dispatcher writes the real 8-hex hash here; CI reads it from this line
DONE: CI green with the path guard, no `not implemented: <TASK>` left. Screenshots (UI only): <specs for bun scripts/shots.ts, or none>
