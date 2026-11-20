import { expect, test } from "bun:test"
import { type Facts, firstError, route } from "./next.ts"

// Run with `bun test scripts/`.
const clean: Facts = {
  ci: "success",
  conflicting: false,
  problems: [],
  reasons: [],
  reply: { pr: 12, worktree: "/w", green: true, disputed: null, couldNotDo: "" },
  rounds: 0,
  failure: undefined
}

test("a clean, green, small PR is merged", () => {
  expect(route(clean)).toEqual({ kind: "merge" })
})

test("the worker's own flags go to the owner before anything else", () => {
  expect(route({ ...clean, ci: "failure", reply: { ...clean.reply!, disputed: "test x is wrong" } }).kind).toBe("owner")
  expect(route({ ...clean, reply: { ...clean.reply!, couldNotDo: "timed out" } }).kind).toBe("owner")
})

test("CI still running waits", () => {
  expect(route({ ...clean, ci: "pending" })).toEqual({ kind: "wait" })
})

test("a conflict, a red CI or a stub left is repaired, until the rounds run out", () => {
  const failure = { finding: "CI fails: x", files: ["be/src/a.ts"] }

  expect(route({ ...clean, conflicting: true }).kind).toBe("heal")
  expect(route({ ...clean, ci: "failure", failure })).toEqual({ kind: "heal", ...failure })
  expect(route({ ...clean, problems: ["stubs left:\nbe/src/a.ts:3"] }).kind).toBe("heal")
  expect(route({ ...clean, ci: "failure", failure, rounds: 4 })).toEqual({ kind: "stopped" })
})

test("critical paths or size go to the owner; only being behind master is rebased", () => {
  expect(route({ ...clean, reasons: ["3. touches critical paths: contract/src/api.ts"] }).kind).toBe("owner")
  expect(route({ ...clean, reasons: ["4. 12 files (max 8)", "1. the branch is 2 commit(s) behind master"] }).kind).toBe("owner")
  expect(route({ ...clean, reasons: ["1. the branch is 2 commit(s) behind master"] })).toEqual({ kind: "rebase" })
})

test("an unlinked PR goes to the owner", () => {
  expect(route({ ...clean, problems: ["not linked to a task issue"] }).kind).toBe("owner")
})

test("the first CI error is cut from the failed log, with the files it names", () => {
  const log = [
    "verify\tverify\t2026-11-21T10:00:00.0Z ✓ lint",
    "verify\tverify\t2026-11-21T10:00:01.0Z ✗ typecheck be",
    "verify\tverify\t2026-11-21T10:00:01.0Z be/src/study/a.ts(3,1): error TS2322",
    "verify\tverify\t2026-11-21T10:00:01.0Z be/src/study/a.ts(9,1): error TS2322",
    "verify\tverify\t2026-11-21T10:00:01.0Z Fix the FIRST error above, then re-run"
  ].join("\n")

  expect(firstError(log)).toEqual({
    finding: "CI fails:\n✗ typecheck be\nbe/src/study/a.ts(3,1): error TS2322\nbe/src/study/a.ts(9,1): error TS2322",
    files: ["be/src/study/a.ts"]
  })
})

test("test failures print paths inside the workspace; they are mapped to the repo root", () => {
  const log = [
    "verify\tverify\t2026-11-21T10:00:01.0Z ✗ test fe",
    "verify\tverify\t2026-11-21T10:00:01.0Z ##[group]src/lib/a.test.ts:",
    "verify\tverify\t2026-11-21T10:00:01.0Z (pass) a > works",
    "verify\tverify\t2026-11-21T10:00:01.0Z (fail) a > breaks",
    "verify\tverify\t2026-11-21T10:00:01.0Z   at src/lib/a.ts:4:2",
    "verify\tverify\t2026-11-21T10:00:01.0Z Fix the FIRST error above, then re-run"
  ].join("\n")

  const result = firstError(log)

  expect(result.files).toEqual(["fe/src/lib/a.test.ts", "fe/src/lib/a.ts"])
  expect(result.finding).not.toContain("(pass)")
})
