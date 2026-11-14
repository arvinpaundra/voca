import { describe, expect, test } from "bun:test"
import { createSession } from "./session.ts"
import { completeSignIn } from "./signIn.ts"
import { createTokenStore, REFRESH_KEY } from "./tokens.ts"

// Google sign-in is a public call: a 401 from it means "this code was refused", not "your session expired".
// It must never refresh or sign out, so the callback page can show its own failure screen.

const REFRESH = "r1".padEnd(43, "x")

const setup = (storedRefresh: string | null) => {
  const storage = new Map<string, string>()
  const store = createTokenStore({
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => void storage.set(k, v),
    removeItem: (k) => void storage.delete(k)
  })
  if (storedRefresh !== null) store.setRefresh(storedRefresh)

  const paths: Array<string> = []
  let signedOut = 0

  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    paths.push(new URL(request.url).pathname)
    return Response.json({ _tag: "Unauthorized", message: "Google sign-in failed" }, { status: 401 })
  }) as typeof globalThis.fetch

  const session = createSession({
    store,
    baseUrl: "http://test",
    fetch,
    lock: (_name, fn) => fn(),
    now: () => 1_000_000,
    onSignedOut: () => void signedOut++
  })

  const signIn = () =>
    completeSignIn({
      search: "?code=refused&state=s-1",
      pkce: () => ({ verifier: "v".repeat(43), state: "s-1" }),
      session,
      redirectUri: "http://localhost:5173/auth/callback",
      timezone: "UTC"
    })

  return { signIn, storage, paths, signedOuts: () => signedOut }
}

describe("a refused Google sign-in", () => {
  test("fails with api-error, and neither refreshes nor signs out", async () => {
    const t = setup(null)

    const outcome = await t.signIn()

    expect(outcome).toEqual({ kind: "failed", reason: "api-error" })
    expect(t.paths).toEqual(["/api/auth/google"])
    expect(t.signedOuts()).toBe(0)
  })

  test("leaves a session that is already stored (another tab) untouched", async () => {
    const t = setup(REFRESH)

    await t.signIn()

    expect(t.paths).toEqual(["/api/auth/google"])
    expect(t.storage.get(REFRESH_KEY)).toBe(REFRESH)
    expect(t.signedOuts()).toBe(0)
  })
})
