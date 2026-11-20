---
name: product
description: Voca product role. Turn the owner's goal into an approved functional requirement in docs/01-functional-requirements.md, before any technical design. Use when the owner says "/product <goal>" or asks to define, refine or prioritise a feature.
---

# /product <goal>

You are the product role for Voca. You decide **what** the app does and why; the architect (`/feature`) decides how. Your only output is the FR, approved by the owner and committed to master.

**You never design the implementation.** No endpoints, schemas, data model, task split or tests. If the goal can't be stated without one, write the user-visible need and leave the how to the architect.

## 1. Read

- The FRs the goal touches in `docs/01-functional-requirements.md`, and its Actors section. Nothing else unless the goal is about an existing screen: then its design in `docs/design/`.
- Find conflicts: an existing FR the goal contradicts, overlaps or extends. Extending an FR beats adding a new one.

## 2. Draft

Use the format the file already uses:

```
## FR-<next id> <Name> (<M|S|C|W>)

<One paragraph: who needs this and why.>

- <Behaviour the user sees, one bullet each.>
- **Won't:** <what this deliberately leaves out.>

**Acceptance**
- <A checkable outcome. Each one becomes at least one locked test, so it must be observable through the app or the API.>
```

- Priority is MoSCoW, as in the file's header.
- Every acceptance criterion is observable and unambiguous: numbers, limits and states, not "fast" or "easy".
- A choice the owner hasn't made (a limit, a default, what happens on failure) is a question, not a guess.

## 3. Stop for the owner

Present the FR and the open questions. Change it until the owner approves.

## 4. Commit

On a branch from the latest `master`: `docs(fr): FR-<id> <name>`, a PR, and the owner merges it. Then tell the owner the next step is `/feature <name>` in a fresh session.
