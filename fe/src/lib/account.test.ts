import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Effect, Result } from "effect"
import { deleteAccount, emailMatches, takeDeletedNotice } from "./account"
import type { ApiClient } from "./api"
import { session, tokenStore } from "./appSession"
import { queryClient } from "./queryClient"

const restores: Array<() => void> = []

afterEach(() => {
  restores.splice(0).forEach((restore) => restore())
  window.localStorage.clear()
  window.history.replaceState(null, "", "/")
})

const signedInTokens = () => {
  tokenStore.setRefresh("r".repeat(43))
  tokenStore.setAccess("access-token", 900, Date.now())
}

const fakeDelete = (outcome: "ok" | "fails") => {
  const sent: Array<string> = []

  const client = {
    me: {
      delete: () => {
        sent.push("delete")
        return Effect.succeed(undefined as never)
      }
    }
  }

  const spy = spyOn(session, "call").mockImplementation(async (f) => {
    const value = await Effect.runPromise(f(client as unknown as ApiClient))
    return outcome === "ok" ? Result.succeed(value) : Result.fail(new Error("500"))
  })

  const assign = spyOn(window.location, "assign").mockImplementation(() => {})

  restores.push(
    () => spy.mockRestore(),
    () => assign.mockRestore()
  )

  return { sent, assign }
}

describe("emailMatches", () => {
  test("is false with nothing typed and with a partial email", () => {
    expect(emailMatches("", "ada@example.com")).toBe(false)
    expect(emailMatches("ada@exam", "ada@example.com")).toBe(false)
    expect(emailMatches("ada@example.co", "ada@example.com")).toBe(false)
  })

  test("is true for the exact email, the email in other letter case, and the email with spaces around it", () => {
    expect(emailMatches("ada@example.com", "ada@example.com")).toBe(true)
    expect(emailMatches("Ada@Example.COM", "ada@example.com")).toBe(true)
    expect(emailMatches("  ada@example.com \t", "ada@example.com")).toBe(true)
    expect(emailMatches("ada@example.com", "Ada@Example.com")).toBe(true)
  })

  test("is false for spaces inside the email or another email", () => {
    expect(emailMatches("ada @example.com", "ada@example.com")).toBe(false)
    expect(emailMatches("bob@example.com", "ada@example.com")).toBe(false)
  })
})

describe("deleteAccount", () => {
  test("deletes the account, clears both tokens and the cache, and leaves for the sign-in page with the notice", async () => {
    signedInTokens()
    queryClient.setQueryData(["me"], { name: "Ada" })
    const { sent, assign } = fakeDelete("ok")

    expect(await deleteAccount()).toBe(true)

    expect(sent).toEqual(["delete"])
    expect(tokenStore.getRefresh()).toBeNull()
    expect(tokenStore.getAccess()).toBeNull()
    expect(queryClient.getQueryData(["me"])).toBeUndefined()
    expect(assign).toHaveBeenCalledWith("/login?deleted")
  })

  test("a failed delete keeps the tokens and the page", async () => {
    signedInTokens()
    const { assign } = fakeDelete("fails")

    expect(await deleteAccount()).toBe(false)

    expect(tokenStore.getRefresh()).toBe("r".repeat(43))
    expect(tokenStore.getAccess()).toBe("access-token")
    expect(assign).not.toHaveBeenCalled()
  })
})

describe("takeDeletedNotice", () => {
  test("is true once on /login?deleted and drops the query, so a reload shows nothing", () => {
    window.history.replaceState(null, "", "/login?deleted")

    expect(takeDeletedNotice()).toBe(true)
    expect(window.location.pathname).toBe("/login")
    expect(window.location.search).toBe("")

    expect(takeDeletedNotice()).toBe(false)
  })

  test("is false on a plain /login", () => {
    window.history.replaceState(null, "", "/login")

    expect(takeDeletedNotice()).toBe(false)
    expect(window.location.pathname).toBe("/login")
  })
})
