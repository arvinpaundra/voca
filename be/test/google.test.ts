import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { DateTime, Effect } from "effect"
import { SqlClient } from "effect/sql"
import { at, call, googleStub, makeIdentityRuntime } from "./identity.ts"
import { resetDb } from "./setup.ts"

// POST /auth/google: Google is stubbed by auth code, so this tests everything after it.
//   first sign-in   → a new Learner with the new-Learner defaults and the request's timezone
//   later sign-ins  → the same Learner; email, name and avatar refreshed from Google; settings untouched
//   every sign-in   → a 15-minute access token and a new refresh-token family
//   Google refuses  → 401 Unauthorized, nothing written

const ada = { sub: "g-ada", email: "ada@example.com", name: "Ada", avatarUrl: "https://lh3.googleusercontent.com/a/ada" }
const rt = makeIdentityRuntime(
  googleStub({
    "code-ada": ada,
    "code-ada-again": { sub: "g-ada", email: "ada@new.example.com", name: "Ada L.", avatarUrl: null },
    "code-bob": { sub: "g-bob", email: "bob@example.com", name: "Bob", avatarUrl: null }
  })
)
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const signIn = (code: string, timezone = "Asia/Jakarta") =>
  call((c) =>
    c.auth.google({
      payload: { code, codeVerifier: "v".repeat(43), redirectUri: "http://localhost:5173/auth/callback", timezone }
    })
  )
const count = (table: "learners" | "refresh_tokens") =>
  SqlClient.SqlClient.pipe(
    Effect.flatMap((sql) => sql<{ readonly n: string }>`SELECT count(*)::text AS n FROM ${sql(table)}`),
    Effect.map((rows) => Number(rows[0]?.n))
  )

describe("POST /auth/google", () => {
  test("the first sign-in creates the Learner with the new-Learner defaults and the request's timezone", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const signedIn = yield* signIn("code-ada")
        expect(String(signedIn.learner.slug)).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
        expect(signedIn.learner).toMatchObject({ email: ada.email, name: ada.name, avatarUrl: ada.avatarUrl })
        expect(DateTime.formatIso(signedIn.learner.createdAt)).toBe("2026-11-14T00:00:00.000Z")
        expect(signedIn.learner.settings).toEqual({
          timezone: "Asia/Jakarta", dayStartHour: 4, desiredRetention: 0.9, newPerDay: 20, defaultSessionSize: 10, defaultMode: "easy"
        })
        expect(signedIn.expiresIn).toBe(900)
        expect(signedIn.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
        const me = yield* call((c) => c.me.get(), signedIn.accessToken)
        expect(me.slug).toBe(signedIn.learner.slug)
      })
    ))

  test("a later sign-in is the same Learner: profile refreshed from Google, settings kept", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const first = yield* signIn("code-ada")
        yield* call((c) => c.me.updateSettings({ payload: { newPerDay: 35, defaultMode: "hard" } }), first.accessToken)
        const second = yield* signIn("code-ada-again", "Europe/Paris") // the timezone only applies to a new account
        expect(second.learner.slug).toBe(first.learner.slug)
        expect(second.learner).toMatchObject({ email: "ada@new.example.com", name: "Ada L.", avatarUrl: null })
        expect(second.learner.settings).toMatchObject({ timezone: "Asia/Jakarta", newPerDay: 35, defaultMode: "hard" })
        expect(yield* count("learners")).toBe(1)
      })
    ))

  test("different Google accounts are different Learners", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const a = yield* signIn("code-ada")
        const b = yield* signIn("code-bob")
        expect(b.learner.slug).not.toBe(a.learner.slug)
        expect(yield* count("learners")).toBe(2)
      })
    ))

  test("every sign-in starts its own refresh-token family, stored only as a hash", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const a = yield* signIn("code-ada")
        const b = yield* signIn("code-ada")
        const sql = yield* SqlClient.SqlClient
        const rows = yield* sql<{ readonly family: string; readonly hex: string }>`
          SELECT family_id::text AS family, encode(token_hash, 'hex') AS hex FROM refresh_tokens ORDER BY id`
        expect(rows).toHaveLength(2)
        expect(rows[0]!.family).not.toBe(rows[1]!.family)
        const sha = (t: string) => new Bun.CryptoHasher("sha256").update(t).digest("hex")
        expect(rows.map((r) => r.hex)).toEqual([sha(a.refreshToken), sha(b.refreshToken)])
      })
    ))

  test("a soft-deleted account with the same Google sub doesn't come back: a new Learner is created", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const old = yield* signIn("code-ada")
        const sql = yield* SqlClient.SqlClient
        yield* sql`UPDATE learners SET deleted_at = now()`
        const fresh = yield* signIn("code-ada")
        expect(fresh.learner.slug).not.toBe(old.learner.slug)
      })
    ))

  test("when Google refuses, 401 Unauthorized and nothing is written", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const error = yield* signIn("code-unknown").pipe(Effect.flip)
        expect(error._tag).toBe("Unauthorized")
        expect(yield* count("learners")).toBe(0)
        expect(yield* count("refresh_tokens")).toBe(0)
      })
    ))
})
