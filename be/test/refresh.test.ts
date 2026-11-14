import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { DateTime, Effect, Option } from "effect"
import { SqlClient } from "effect/sql"
import { RefreshTokens } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// POST /auth/refresh, rotation with reuse detection:
//   unknown / expired / revoked → 401 RefreshTokenInvalid
//   already used (reuse!)        → revoke the whole family, 401 RefreshTokenInvalid
//   ok                           → mark it used, issue a new one in the same family (30 days from now), new access token
// Tokens are seeded through the RefreshTokens store, so this suite doesn't depend on Google sign-in.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const issue = (learnerId: bigint) => RefreshTokens.pipe(Effect.flatMap((tokens) => tokens.issue(learnerId)))
const refresh = (refreshToken: string) => call((c) => c.auth.refresh({ payload: { refreshToken } }))
const rejected = (refreshToken: string) =>
  refresh(refreshToken).pipe(
    Effect.flip,
    Effect.map((error) => error._tag)
  )
const row = (token: string) => RefreshTokens.pipe(Effect.flatMap((t) => t.findForUpdate(token)), Effect.map(Option.getOrThrow))

describe("POST /auth/refresh", () => {
  test("rotates: a new pair in the same family, the old token marked used, the new access token works", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const old = yield* issue(learnerId)
        yield* at("2026-11-20T00:00:00Z")
        const next = yield* refresh(old.token)
        expect(next.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(next.refreshToken).not.toBe(old.token)
        expect(next.expiresIn).toBe(900)
        const me = yield* call((c) => c.me.get(), next.accessToken)
        expect(String(me.slug)).toBe("ABCDEFGH")
        const oldRow = yield* row(old.token)
        expect(oldRow.usedAt && DateTime.formatIso(oldRow.usedAt)).toBe("2026-11-20T00:00:00.000Z")
        const newRow = yield* row(next.refreshToken)
        expect(newRow.familyId).toBe(old.familyId)
        expect(DateTime.formatIso(newRow.expiresAt)).toBe("2026-12-20T00:00:00.000Z") // sliding: 30 days from the rotation
      })
    ))

  test("reuse of an old token revokes the family, so the newer token is rejected too", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const first = yield* issue(learnerId)
        const second = yield* refresh(first.token)
        expect(yield* rejected(first.token)).toBe("RefreshTokenInvalid")
        expect(yield* rejected(second.refreshToken)).toBe("RefreshTokenInvalid")
        expect((yield* row(second.refreshToken)).revokedAt).not.toBeNull()
      })
    ))

  test("reuse revokes only that family, not the learner's other sessions", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const phone = yield* issue(learnerId)
        const laptop = yield* issue(learnerId)
        yield* refresh(phone.token)
        yield* rejected(phone.token) // reuse on the phone
        const stillFine = yield* refresh(laptop.token)
        expect(stillFine.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
      })
    ))

  test("two concurrent refreshes with the same token: exactly one succeeds", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const { token } = yield* issue(learnerId)
        const results = yield* Effect.all([refresh(token), refresh(token)].map(Effect.result), { concurrency: 2 })
        expect(results.filter((r) => r._tag === "Success")).toHaveLength(1)
        expect(results.filter((r) => r._tag === "Failure")).toHaveLength(1)
      })
    ))

  test("an expired token is rejected; one still inside its 30 days is not", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const young = yield* issue(learnerId)
        const old = yield* issue(learnerId)
        yield* at("2026-12-13T23:59:00Z") // 29 days 23:59 later
        yield* refresh(young.token)
        yield* at("2026-12-14T00:00:01Z") // past 30 days
        expect(yield* rejected(old.token)).toBe("RefreshTokenInvalid")
      })
    ))

  test("a revoked token, an unknown token and a deleted learner are all rejected the same way", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const revoked = yield* issue(learnerId)
        yield* RefreshTokens.pipe(Effect.flatMap((t) => t.revokeFamily(revoked.familyId)))
        expect(yield* rejected(revoked.token)).toBe("RefreshTokenInvalid")
        expect(yield* rejected("A".repeat(43))).toBe("RefreshTokenInvalid")
        const orphan = yield* issue(learnerId)
        const sql = yield* SqlClient.SqlClient
        yield* sql`UPDATE learners SET deleted_at = now() WHERE id = ${learnerId}`
        expect(yield* rejected(orphan.token)).toBe("RefreshTokenInvalid")
      })
    ))
})
