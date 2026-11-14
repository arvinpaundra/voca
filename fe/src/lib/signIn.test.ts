import { describe, expect, test } from "bun:test"
import { createSession } from "./session.ts"
import { completeSignIn, loadCurrentLearner } from "./signIn.ts"
import { createTokenStore, REFRESH_KEY } from "./tokens.ts"

// Signing in after the Google redirect, and finding out on app load whether someone is signed in.

const learner = {
  slug: "ABCDEFGH",
  email: "ada@example.com",
  name: "Ada",
  avatarUrl: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  settings: {
    timezone: "Asia/Jakarta",
    dayStartHour: 4,
    desiredRetention: 0.9,
    newPerDay: 20,
    defaultSessionSize: 10,
    defaultMode: "easy"
  }
}

const REFRESH = "r1".padEnd(43, "x")
const json = (status: number, body: unknown) => Response.json(body, { status })

/** A fake API: Google sign-in accepts the code "good", `/me` accepts the access token it issued. */
const setup = () => {
  const storage = new Map<string, string>()
  const store = createTokenStore({
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => void storage.set(k, v),
    removeItem: (k) => void storage.delete(k)
  })

  const requests: Array<{ path: string; body: unknown }> = []

  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    const body = request.method === "POST" ? await request.json() : null
    requests.push({ path, body })

    if (path === "/api/auth/google") {
      const { code } = body as { code: string }
      return code === "good"
        ? json(200, { accessToken: "a1", refreshToken: REFRESH, expiresIn: 900, learner })
        : json(401, { _tag: "Unauthorized", message: "Google sign-in failed" })
    }

    if (path === "/api/auth/refresh") {
      return json(200, { accessToken: "a2", refreshToken: "r2".padEnd(43, "x"), expiresIn: 900 })
    }

    if (path === "/api/me") {
      const token = request.headers.get("authorization")
      return token === "Bearer a1" || token === "Bearer a2"
        ? json(200, learner)
        : json(401, { _tag: "Unauthorized", message: "no" })
    }

    return json(404, {})
  }) as typeof globalThis.fetch

  const session = createSession({
    store,
    baseUrl: "http://test",
    fetch,
    lock: (_name, fn) => fn(),
    now: () => 1_000_000,
    onSignedOut: () => {}
  })

  return { session, store, storage, requests }
}

const PKCE = { verifier: "v".repeat(43), state: "s-123" }

const callback = (t: ReturnType<typeof setup>, search: string, pkce: typeof PKCE | null = PKCE) =>
  completeSignIn({
    search,
    pkce: () => pkce,
    session: t.session,
    redirectUri: "http://localhost:5173/auth/callback",
    timezone: "Asia/Jakarta"
  })

describe("completeSignIn", () => {
  test("a good callback exchanges the code once, stores the tokens and returns the learner", async () => {
    const t = setup()

    const outcome = await callback(t, "?code=good&state=s-123")

    expect(outcome).toEqual({ kind: "signed-in", learner: expect.objectContaining({ slug: "ABCDEFGH" }) })
    expect(t.requests).toEqual([
      {
        path: "/api/auth/google",
        body: {
          code: "good",
          codeVerifier: PKCE.verifier,
          redirectUri: "http://localhost:5173/auth/callback",
          timezone: "Asia/Jakarta"
        }
      }
    ])
    expect(t.storage.get(REFRESH_KEY)).toBe(REFRESH)
    expect(t.store.getAccess()).toBe("a1")
  })

  test.each([
    ["google-error", "?error=access_denied&state=s-123", PKCE],
    ["missing-code", "?state=s-123", PKCE],
    ["no-pkce", "?code=good&state=s-123", null],
    ["state-mismatch", "?code=good&state=someone-else", PKCE]
  ] as const)("%s: fails without calling the API or storing anything", async (reason, search, pkce) => {
    const t = setup()

    const outcome = await callback(t, search, pkce)

    expect(outcome).toEqual({ kind: "failed", reason })
    expect(t.requests).toEqual([])
    expect(t.storage.has(REFRESH_KEY)).toBe(false)
  })

  test("api-error: the API refuses the code, nothing is stored", async () => {
    const t = setup()

    const outcome = await callback(t, "?code=bad&state=s-123")

    expect(outcome).toEqual({ kind: "failed", reason: "api-error" })
    expect(t.storage.has(REFRESH_KEY)).toBe(false)
    expect(t.store.getAccess()).toBeNull()
  })
})

describe("loadCurrentLearner", () => {
  test("no refresh token: null, and no request at all", async () => {
    const t = setup()

    expect(await loadCurrentLearner(t.session, t.store)).toBeNull()
    expect(t.requests).toEqual([])
  })

  test("after a reload (refresh token kept, access token gone): refreshes, then returns the learner", async () => {
    const t = setup()
    t.store.setRefresh(REFRESH)

    const found = await loadCurrentLearner(t.session, t.store)

    expect(String(found?.slug)).toBe("ABCDEFGH")
    expect(t.requests.map((r) => r.path)).toEqual(["/api/auth/refresh", "/api/me"])
  })

  test("right after sign-in: uses the access token it already has", async () => {
    const t = setup()
    await callback(t, "?code=good&state=s-123")

    const found = await loadCurrentLearner(t.session, t.store)

    expect(String(found?.slug)).toBe("ABCDEFGH")
    expect(t.requests.map((r) => r.path)).toEqual(["/api/auth/google", "/api/me"])
  })
})
