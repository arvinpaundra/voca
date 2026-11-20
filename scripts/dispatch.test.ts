import { expect, test } from "bun:test"
import { parseReply, tier } from "./dispatch.ts"

// Run with `bun test scripts/`.
const reply = { pr: 12, worktree: "/w", green: true, disputed: null, couldNotDo: "" }

test("repair rounds climb the model tiers, then stop", () => {
  expect([1, 2, 3, 4, 5].map(tier)).toEqual(["haiku", "haiku", "sonnet", "opus", undefined])
})

test("a structured reply is taken as is", () => {
  expect(parseReply(JSON.stringify({ subtype: "success", structured_output: reply }), "/w", false, 60)).toEqual(reply)
})

test("anything else becomes a failed reply that says why", () => {
  const failed = (stdout: string, timedOut = false) => parseReply(stdout, "/w", timedOut, 60)

  expect(failed("", true).couldNotDo).toBe("timed out after 60 min")
  expect(failed(JSON.stringify({ subtype: "error_max_turns" })).couldNotDo).toBe("stopped at the max-turns limit")
  expect(failed("not json").couldNotDo).toContain("unreadable")
  expect(failed(JSON.stringify({ subtype: "success", result: "done" }))).toMatchObject({ pr: null, green: false })
})
