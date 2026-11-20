import { expect, test } from "bun:test"
import { addedLines, check, parseLcov } from "./diff-coverage.ts"

// Run with `bun test scripts/`.
const diff = `diff --git a/be/src/library/deck.ts b/be/src/library/deck.ts
--- a/be/src/library/deck.ts
+++ b/be/src/library/deck.ts
@@ -3,0 +4,3 @@ export const a = 1
+export const b = 2
+// a comment
+export const c = 3
@@ -9 +12 @@
+export const d = 4
diff --git a/be/src/library/gone.ts b/be/src/library/gone.ts
--- a/be/src/library/gone.ts
+++ /dev/null
@@ -1 +0,0 @@
-export const gone = 1
diff --git a/fe/src/routes/deck.tsx b/fe/src/routes/deck.tsx
--- a/fe/src/routes/deck.tsx
+++ b/fe/src/routes/deck.tsx
@@ -1,0 +2 @@
+export const screen = 1
`

const lcov = `SF:src/library/deck.ts
DA:4,3
DA:6,1
DA:12,0
end_of_record
SF:../contract/src/api.ts
DA:1,5
end_of_record
`

test("reads the added lines of each file and skips deleted files", () => {
  const added = addedLines(diff)

  expect(added.get("be/src/library/deck.ts")).toEqual([4, 5, 6, 12])
  expect(added.has("be/src/library/gone.ts")).toBe(false)
  expect(added.get("fe/src/routes/deck.tsx")).toEqual([2])
})

test("maps lcov paths from the workspace to the repo root", () => {
  const coverage = parseLcov(lcov, "be")

  expect(coverage.get("be/src/library/deck.ts")?.get(12)).toBe(0)
  expect(coverage.has("contract/src/api.ts")).toBe(true)
})

test("counts only executable added lines, and fails under the minimum", () => {
  const result = check(addedLines(diff), parseLcov(lcov, "be"))

  // Line 5 is a comment (absent from the report); fe/src/routes is out of scope.
  expect(result).toMatchObject({ ok: false, executable: 3, covered: 2, uncovered: ["be/src/library/deck.ts:12"], unloaded: [] })
})

test("a fully run diff passes", () => {
  const all = lcov.replace("DA:12,0", "DA:12,1")

  expect(check(addedLines(diff), parseLcov(all, "be")).ok).toBe(true)
})

test("an added file no test loads only warns, and main.ts and tests are skipped", () => {
  const added = new Map([
    ["be/src/study/new.ts", [1, 2]],
    ["be/src/main.ts", [3]],
    ["be/test/new.test.ts", [1]]
  ])

  expect(check(added, new Map())).toMatchObject({ ok: true, unloaded: ["be/src/study/new.ts"] })
})
