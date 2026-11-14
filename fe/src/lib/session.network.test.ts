import { describe, expect, test } from "bun:test"
import { Result } from "effect"
import { createSession } from "./session.ts"
import { createTokenStore, REFRESH_KEY } from "./tokens.ts"

// A failed refresh signs out only when the server rejects the refresh token. A network error or a server error
// keeps both tokens and fails only that call, so the next call can try again once the connection is back.

const learner = {
  slug: "ABCDEFGH",
  email: "ada@example.com",
  name: "Ada",
  avatarUrl: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  settings: {
    timezone: "UTC",
    dayStartHour: 4,
    desiredRetention: 0.9,
    newPerDay: 20,
    defaultSessionSize: 10,
    defaultMode: "easy"
  }
}

const R1 = "r1".padEnd(43, "x")
const R2 = "r2".padEnd(43, "x")

const json = (status: number, body: unknown) => Response.json(body, { status })

type RefreshOutcome = "network-error" | "server-error" | "rejected" | "rotates"

/** A fake API whose refresh endpoint fails the way the test says, until it is told to work again. */
const setup = (refresh: RefreshOutcome) => {
  const storage = new Map<string, string>()
  const store = createTokenStore({
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => void storage.set(k, v),
    removeItem: (k) => void storage.delete(k)
  })

  const state = { refresh, validAccess: new Set<string>(), refreshCalls: 0, signedOut: 0 }

  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname

    if (path === "/api/me") {
      const token = request.headers.get("authorization")?.replace("Bearer ", "")
      return token && state.validAccess.has(token)
        ? json(200, learner)
        : json(401, { _tag: "Unauthorized", message: "no" })
    }

    if (path === "/api/auth/refresh") {
      state.refreshCalls++
      if (state.refresh === "network-error") throw new TypeError("Failed to fetch")
      if (state.refresh === "server-error") return json(500, { message: "boom" })
      if (state.refresh === "rejected") return json(401, { _tag: "RefreshTokenInvalid", message: "no" })
      state.validAccess.add("a2")
      return json(200, { accessToken: "a2", refreshToken: R2, expiresIn: 900 })
    }

    return json(404, {})
  }) as typeof globalThis.fetch

  store.setRefresh(R1)
  store.setAccess("stale", 900, 1_000_000) // not valid on the server: the first call gets 401

  const session = createSession({
    store,
    baseUrl: "http://test",
    fetch,
    lock: (_name, fn) => fn(),
    now: () => 1_000_000,
    onSignedOut: () => void state.signedOut++
  })

  return { session, store, storage, state }
}

describe("a refresh that fails without the server rejecting the token", () => {
  test.each(["network-error", "server-error"] as const)("%s: the call fails, both tokens stay, no sign-out", async (outcome) => {
    const t = setup(outcome)

    const result = await t.session.call((c) => c.me.get())

    expect(Result.isFailure(result)).toBe(true)
    expect(t.state.refreshCalls).toBe(1)
    expect(t.storage.get(REFRESH_KEY)).toBe(R1)
    expect(t.store.getAccess()).toBe("stale")
    expect(t.state.signedOut).toBe(0)
  })

  test("once the connection is back, the next call refreshes with the kept token and succeeds", async () => {
    const t = setup("network-error")
    await t.session.call((c) => c.me.get())

    t.state.refresh = "rotates"
    const result = await t.session.call((c) => c.me.get())

    expect(Result.isSuccess(result)).toBe(true)
    expect(t.storage.get(REFRESH_KEY)).toBe(R2)
    expect(t.state.signedOut).toBe(0)
  })
})

describe("a refresh token the server rejects", () => {
  test("signs out once and clears both tokens", async () => {
    const t = setup("rejected")

    const result = await t.session.call((c) => c.me.get())

    expect(Result.isFailure(result)).toBe(true)
    expect(t.storage.has(REFRESH_KEY)).toBe(false)
    expect(t.store.getAccess()).toBeNull()
    expect(t.state.signedOut).toBe(1)
  })
})
