import { describe, expect, test } from "bun:test"
import { Result } from "effect"
import { createSession } from "./session.ts"
import { createTokenStore, REFRESH_KEY } from "./tokens.ts"

// The session client:
//   401 → refresh once → retry once; fewer than 60 s left → refresh before the call;
//   refreshes go through the `voca-refresh` lock and use the refresh token in storage *at that moment*
//   (another tab may have rotated it); a failed refresh signs out.

const learner = {
  slug: "ABCDEFGH", email: "ada@example.com", name: "Ada", avatarUrl: null, createdAt: "2026-11-01T00:00:00.000Z",
  settings: { timezone: "UTC", dayStartHour: 4, desiredRetention: 0.9, newPerDay: 20, defaultSessionSize: 10, defaultMode: "easy" }
}
const R = (n: number) => `r${n}`.padEnd(43, "x") // a well-formed refresh token
const json = (status: number, body: unknown) => Response.json(body, { status })

/** A fake API: knows which access tokens are valid and what each refresh token rotates into. */
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
      rotations.delete(refreshToken) // rotation: the old one is spent
      validAccess.add(next.accessToken)
      return json(200, { ...next, expiresIn: 900 })
    }
    if (path === "/api/auth/logout") return new Response(null, { status: 204 })
    return json(404, {})
  }) as typeof globalThis.fetch
  return { fetch, validAccess, rotations, log, refreshes: () => log.filter((l) => l.endsWith("/auth/refresh")).length }
}

const memoryStorage = () => {
  const data = new Map<string, string>()
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
}

/** A Web Locks stand-in: runs holders of the same name one after another, and records the names. */
const fakeLocks = () => {
  const names: Array<string> = []
  let tail: Promise<unknown> = Promise.resolve()
  const lock = <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    names.push(name)
    const run = tail.then(fn, fn)
    tail = run.catch(() => undefined)
    return run
  }
  return { lock, names }
}

const setup = (opts: { access?: string; refresh?: string; now?: number } = {}) => {
  const server = fakeServer()
  const storage = memoryStorage()
  const store = createTokenStore(storage)
  const locks = fakeLocks()
  let clock = opts.now ?? 1_000_000
  let signedOut = 0
  if (opts.refresh) store.setRefresh(opts.refresh)
  if (opts.access) {
    store.setAccess(opts.access, 900, clock)
    server.validAccess.add(opts.access)
  }
  const session = createSession({
    store, baseUrl: "http://test", fetch: server.fetch, lock: locks.lock, now: () => clock, onSignedOut: () => void signedOut++
  })
  return { session, server, storage, store, locks, signedOuts: () => signedOut, advance: (ms: number) => void (clock += ms) }
}

describe("session.call", () => {
  test("with a valid access token: one request, no refresh", async () => {
    const t = setup({ access: "a1", refresh: R(1) })
    const result = await t.session.call((c) => c.me.get())
    expect(Result.isSuccess(result)).toBe(true)
    expect(t.server.log).toEqual(["GET /api/me"])
  })

  test("401 → refresh once with the stored refresh token → retry once with the new access token", async () => {
    const t = setup({ access: "stale", refresh: R(1) })
    t.server.validAccess.delete("stale")
    t.server.rotations.set(R(1), { accessToken: "a2", refreshToken: R(2) })
    const result = await t.session.call((c) => c.me.get())
    expect(Result.isSuccess(result)).toBe(true)
    expect(t.server.log).toEqual(["GET /api/me", "POST /api/auth/refresh", "GET /api/me"])
    expect(t.storage.data.get(REFRESH_KEY)).toBe(R(2))
    expect(t.store.getAccess()).toBe("a2")
    expect(t.locks.names).toEqual(["voca-refresh"])
  })

  test("refreshes before the call when fewer than 60 s remain", async () => {
    const t = setup({ access: "a1", refresh: R(1) })
    t.server.rotations.set(R(1), { accessToken: "a2", refreshToken: R(2) })
    t.advance(900_000 - 30_000) // 30 s left
    await t.session.call((c) => c.me.get())
    expect(t.server.log).toEqual(["POST /api/auth/refresh", "GET /api/me"])
  })

  test("two calls that both get 401 share one refresh", async () => {
    const t = setup({ access: "stale", refresh: R(1) })
    t.server.validAccess.delete("stale")
    t.server.rotations.set(R(1), { accessToken: "a2", refreshToken: R(2) })
    const [a, b] = await Promise.all([t.session.call((c) => c.me.get()), t.session.call((c) => c.me.get())])
    expect(Result.isSuccess(a) && Result.isSuccess(b)).toBe(true)
    expect(t.server.refreshes()).toBe(1)
  })

  test("uses the refresh token in storage when the lock is acquired: another tab may have rotated it", async () => {
    const t = setup({ access: "stale", refresh: R(1) })
    t.server.validAccess.delete("stale")
    t.storage.data.set(REFRESH_KEY, R(5)) // another tab rotated R1 → R5 meanwhile
    t.server.rotations.set(R(5), { accessToken: "a6", refreshToken: R(6) })
    const result = await t.session.call((c) => c.me.get())
    expect(Result.isSuccess(result)).toBe(true)
    expect(t.storage.data.get(REFRESH_KEY)).toBe(R(6))
  })

  test("a refresh that fails clears the tokens and signs out once", async () => {
    const t = setup({ access: "stale", refresh: R(1) })
    t.server.validAccess.delete("stale") // and R(1) rotates into nothing: RefreshTokenInvalid
    const result = await t.session.call((c) => c.me.get())
    expect(Result.isFailure(result)).toBe(true)
    expect(t.storage.data.has(REFRESH_KEY)).toBe(false)
    expect(t.store.getAccess()).toBeNull()
    expect(t.signedOuts()).toBe(1)
  })

  test("with no refresh token, a 401 signs out without trying to refresh", async () => {
    const t = setup({})
    await t.session.call((c) => c.me.get())
    expect(t.server.refreshes()).toBe(0)
    expect(t.signedOuts()).toBe(1)
  })
})

describe("session.signIn / signOut", () => {
  test("signIn stores the tokens; the next call uses the new access token", async () => {
    const t = setup({})
    t.server.validAccess.add("fresh")
    t.session.signIn({ accessToken: "fresh", refreshToken: R(1), expiresIn: 900 } as never)
    expect(t.storage.data.get(REFRESH_KEY)).toBe(R(1))
    expect(Result.isSuccess(await t.session.call((c) => c.me.get()))).toBe(true)
  })

  test("signOut revokes the refresh token on the server, clears both tokens and signs out", async () => {
    const t = setup({ access: "a1", refresh: R(1) })
    await t.session.signOut()
    expect(t.server.log).toEqual(["POST /api/auth/logout"])
    expect(t.storage.data.has(REFRESH_KEY)).toBe(false)
    expect(t.store.getAccess()).toBeNull()
    expect(t.signedOuts()).toBe(1)
  })
})
