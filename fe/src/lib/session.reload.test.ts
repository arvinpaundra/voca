import { describe, expect, test } from "bun:test"
import { Result } from "effect"
import { createSession } from "./session.ts"
import { createTokenStore } from "./tokens.ts"

// A reload is a fresh token store and session over the same storage, at a later time.

const learner = {
  slug: "ABCDEFGH",
  email: "ada@example.com",
  name: "Ada",
  avatarUrl: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  settings: { timezone: "UTC", dayStartHour: 4, desiredRetention: 0.9, newPerDay: 20, defaultSessionSize: 10, defaultMode: "easy" }
}

const R = (n: number) => `r${n}`.padEnd(43, "x")

const json = (status: number, body: unknown) => Response.json(body, { status })

const MINUTE = 60_000

/** A fake API shared by every page load: valid access tokens, and what each refresh token rotates into. */
const fakeServer = () => {
  const validAccess = new Set<string>()
  const rotations = new Map<string, { accessToken: string; refreshToken: string }>()
  const log: Array<string> = []

  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    log.push(`${request.method} ${path}`)

    if (path === "/api/me") {
      const token = request.headers.get("authorization")?.replace("Bearer ", "")
      return token && validAccess.has(token) ? json(200, learner) : json(401, { _tag: "Unauthorized", message: "no" })
    }

    if (path === "/api/auth/refresh") {
      const { refreshToken } = (await request.json()) as { refreshToken: string }
      const next = rotations.get(refreshToken)
      if (!next) return json(401, { _tag: "RefreshTokenInvalid", message: "no" })
      rotations.delete(refreshToken)
      validAccess.add(next.accessToken)
      return json(200, { ...next, expiresIn: 900 })
    }

    if (path === "/api/auth/logout") return new Response(null, { status: 204 })
    return json(404, {})
  }) as typeof globalThis.fetch

  return {
    fetch,
    validAccess,
    rotations,
    log,
    refreshes: () => log.filter((line) => line.endsWith("/auth/refresh")).length
  }
}

const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k)
  }
}

/** One browser: its storage and the API persist across page loads; each `load` is a fresh page at `now`. */
const browser = () => {
  const server = fakeServer()
  const storage = memoryStorage()
  let signedOuts = 0

  const load = (now: number) => {
    const store = createTokenStore(storage)
    const session = createSession({
      store,
      baseUrl: "http://test",
      fetch: server.fetch,
      lock: (_name, fn) => fn(),
      now: () => now,
      onSignedOut: () => void signedOuts++
    })
    return { store, session }
  }

  return { server, storage, load, signedOuts: () => signedOuts }
}

describe("a reload", () => {
  test("within the access token's lifetime makes no refresh call", async () => {
    const b = browser()
    b.server.validAccess.add("a1")
    b.load(0).session.signIn({ accessToken: "a1", refreshToken: R(1), expiresIn: 900 } as never)

    const page = b.load(10 * MINUTE)
    const result = await page.session.call((c) => c.me.get())

    expect(Result.isSuccess(result)).toBe(true)
    expect(b.server.log).toEqual(["GET /api/me"])
    expect(b.server.refreshes()).toBe(0)
  })

  test("after the access token expired makes exactly one refresh call and stays signed in", async () => {
    const b = browser()
    b.server.validAccess.add("a1")
    b.server.rotations.set(R(1), { accessToken: "a2", refreshToken: R(2) })
    b.load(0).session.signIn({ accessToken: "a1", refreshToken: R(1), expiresIn: 900 } as never)
    b.server.validAccess.delete("a1")

    const page = b.load(16 * MINUTE)
    const first = await page.session.call((c) => c.me.get())
    const second = await page.session.call((c) => c.me.get())

    expect(Result.isSuccess(first)).toBe(true)
    expect(Result.isSuccess(second)).toBe(true)
    expect(b.server.refreshes()).toBe(1)
    expect(b.signedOuts()).toBe(0)

    const later = b.load(17 * MINUTE)
    await later.session.call((c) => c.me.get())
    expect(b.server.refreshes()).toBe(1)
  })

  test("after signing out finds no token and is signed out", async () => {
    const b = browser()
    b.server.validAccess.add("a1")
    const before = b.load(0)
    before.session.signIn({ accessToken: "a1", refreshToken: R(1), expiresIn: 900 } as never)

    await before.session.signOut()

    expect(b.storage.data.size).toBe(0)

    const page = b.load(MINUTE)
    expect(page.store.getAccess()).toBeNull()
    expect(page.store.getRefresh()).toBeNull()

    const result = await page.session.call((c) => c.me.get())
    expect(Result.isFailure(result)).toBe(true)
    expect(b.server.refreshes()).toBe(0)
  })
})
