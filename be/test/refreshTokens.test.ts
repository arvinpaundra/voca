import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { DateTime, Effect, Option } from "effect"
import { SqlClient } from "effect/sql"
import { RefreshTokens } from "../src/identity/application/ports.ts"
import { at, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// The refresh-token store (docs/08 "Tokens"): opaque 32-byte tokens, only their sha256 stored, 30-day expiry.
const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(resetDb))

describe("RefreshTokens", () => {
  test("issues an opaque token that expires in 30 days and stores only its hash", () =>
    rt.runPromise(
      Effect.gen(function* () {
        yield* at("2026-11-14T00:00:00Z")
        const learnerId = yield* seedLearner("ABCDEFGH")
        const tokens = yield* RefreshTokens
        const { token, familyId } = yield* tokens.issue(learnerId)
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
        const sql = yield* SqlClient.SqlClient
        const rows = yield* sql<{ readonly hex: string }>`SELECT encode(token_hash, 'hex') AS hex FROM refresh_tokens`
        expect(rows).toHaveLength(1)
        expect(rows[0]!.hex).toBe(new Bun.CryptoHasher("sha256").update(token).digest("hex"))
        const found = Option.getOrThrow(yield* tokens.findForUpdate(token))
        expect(found).toMatchObject({ learnerId, familyId, usedAt: null, revokedAt: null })
        expect(DateTime.formatIso(found.expiresAt)).toBe("2026-12-14T00:00:00.000Z")
      })
    ))

  test("a token issued into a family joins it; an unknown token is not found", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const tokens = yield* RefreshTokens
        const first = yield* tokens.issue(learnerId)
        const second = yield* tokens.issue(learnerId, first.familyId)
        expect(second.familyId).toBe(first.familyId)
        expect(second.token).not.toBe(first.token)
        expect(Option.isNone(yield* tokens.findForUpdate("A".repeat(43)))).toBe(true)
      })
    ))

  test("markUsed and revokeFamily stamp the current time, and revoking leaves other families alone", () =>
    rt.runPromise(
      Effect.gen(function* () {
        yield* at("2026-11-14T10:00:00Z")
        const learnerId = yield* seedLearner("ABCDEFGH")
        const tokens = yield* RefreshTokens
        const a1 = yield* tokens.issue(learnerId)
        const a2 = yield* tokens.issue(learnerId, a1.familyId)
        const b1 = yield* tokens.issue(learnerId)
        const a1Row = Option.getOrThrow(yield* tokens.findForUpdate(a1.token))
        yield* tokens.markUsed(a1Row.id)
        yield* tokens.revokeFamily(a1.familyId)
        const used = Option.getOrThrow(yield* tokens.findForUpdate(a1.token))
        expect(used.usedAt && DateTime.formatIso(used.usedAt)).toBe("2026-11-14T10:00:00.000Z")
        expect(used.revokedAt).not.toBeNull()
        expect(Option.getOrThrow(yield* tokens.findForUpdate(a2.token)).revokedAt).not.toBeNull()
        expect(Option.getOrThrow(yield* tokens.findForUpdate(b1.token)).revokedAt).toBeNull()
      })
    ))
})
