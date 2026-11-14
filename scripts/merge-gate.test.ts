import { expect, test } from "bun:test"
import { assess, type PrFacts } from "./merge-gate.ts"

// Run with `bun test scripts/`.
const base: PrFacts = {
  ciGreen: true, behindMaster: 0, linkedTaskIssue: true,
  files: [{ path: "be/src/library/application/createDeck.ts", lines: 80 }, { path: "be/test/decks.test.ts", lines: 150 }],
  locked: ["be/test/decks.test.ts"]
}

test("a small, green, up-to-date feature PR may be merged by the agent", () => {
  expect(assess(base)).toEqual([])
})

test("red CI or a stale branch needs the owner", () => {
  expect(assess({ ...base, ciGreen: false })).toHaveLength(1)
  expect(assess({ ...base, behindMaster: 2 })[0]).toContain("behind master")
})

test.each([
  "contract/src/library.ts", "be/migrations/0002_x.ts", "be/src/identity/application/refresh.ts", "be/src/shared/db.ts",
  "lint/layers.yml", "scripts/verify.ts", ".github/workflows/ci.yml", ".claude/hooks/guard.ts", "AGENTS.md",
  "docs/13-decisions.md", "package.json", "fe/package.json", "bun.lock"
])("a critical path needs the owner: %s", (path) => {
  expect(assess({ ...base, files: [...base.files, { path, lines: 1 }] })[0]).toContain("critical")
})

test("docs other than decisions are not critical", () => {
  expect(assess({ ...base, files: [{ path: "docs/agents/loop.md", lines: 4 }], locked: [] })).toEqual([])
})

test("size: locked tests don't count, everything else does", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ path: `fe/src/features/x${i}.tsx`, lines: 10 }))
  expect(assess({ ...base, files: many, locked: [] })[0]).toContain("9 files")
  expect(assess({ ...base, files: [{ path: "fe/src/a.ts", lines: 301 }], locked: [] })[0]).toContain("301 changed lines")
  expect(assess({ ...base, files: [{ path: "be/test/big.test.ts", lines: 900 }], locked: ["be/test/big.test.ts"] })).toEqual([])
})
