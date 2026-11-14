import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { RefreshTokens } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// POST /auth/logout (docs/08): revokes the token's family and answers 204. It never says whether the token existed,
// so it answers 204 for an unknown or already-revoked token too.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const issue = (learnerId: bigint, familyId?: string) =>
  RefreshTokens.pipe(Effect.flatMap((tokens) => tokens.issue(learnerId, familyId)))
const logout = (refreshToken: string) => call((c) => c.auth.logout({ payload: { refreshToken } }))
const revokedAt = (token: string) =>
  RefreshTokens.pipe(Effect.flatMap((t) => t.findForUpdate(token)), Effect.map((r) => Option.getOrThrow(r).revokedAt))

describe("POST /auth/logout", () => {
  test("revokes every token of the family", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const a = yield* issue(learnerId)
        const b = yield* issue(learnerId, a.familyId)
        yield* logout(b.token)
        expect(yield* revokedAt(a.token)).not.toBeNull()
        expect(yield* revokedAt(b.token)).not.toBeNull()
      })
    ))

  test("leaves the learner's other families signed in", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const phone = yield* issue(learnerId)
        const laptop = yield* issue(learnerId)
        yield* logout(phone.token)
        expect(yield* revokedAt(laptop.token)).toBeNull()
      })
    ))

  test("answers 204 for an unknown token and for a second logout", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const a = yield* issue(learnerId)
        yield* logout("A".repeat(43))
        yield* logout(a.token)
        yield* logout(a.token)
        expect(yield* revokedAt(a.token)).not.toBeNull()
      })
    ))
})
