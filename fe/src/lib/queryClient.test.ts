import { expect, test } from "bun:test"
import { Result } from "effect"
import { orReject } from "./queryClient"

test("a successful call resolves to its value", async () => {
  expect(await orReject(Promise.resolve(Result.succeed(3)))).toBe(3)
})

test("a failed call rejects with its error, so the query shows it", async () => {
  const error = { _tag: "NotFound" }

  await expect(orReject(Promise.resolve(Result.fail(error)))).rejects.toBe(error)
})
