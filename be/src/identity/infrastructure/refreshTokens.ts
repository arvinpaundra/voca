import { Clock, Effect, Layer, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { RefreshTokens } from "../application/ports.ts"

const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000 // 30 days, renewed on every rotation (docs/08)

const RefreshTokenRow = Schema.Struct({
  id: Schema.BigIntFromString, // selected as `id::text`, like every bigint
  learnerId: Schema.BigIntFromString,
  familyId: Schema.String,
  expiresAt: Schema.DateTimeUtcFromDate,
  usedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate)
})

const sha256 = (token: string) => Buffer.from(new Bun.CryptoHasher("sha256").update(token).digest())
const newToken = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")

export const RefreshTokensLive = Layer.effect(
  RefreshTokens,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const now = Clock.currentTimeMillis.pipe(Effect.map((ms) => new Date(ms)))

    const findForUpdate = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: RefreshTokenRow,
      execute: (token) => sql`
        SELECT id::text AS id, learner_id::text AS "learnerId", family_id::text AS "familyId",
               expires_at AS "expiresAt", used_at AS "usedAt", revoked_at AS "revokedAt"
        FROM refresh_tokens WHERE token_hash = ${sha256(token)} FOR UPDATE`
    })

    return RefreshTokens.of({
      issue: (learnerId, familyId) =>
        Effect.gen(function* () {
          const createdAt = yield* now
          const token = newToken()
          const family = familyId ?? crypto.randomUUID()
          yield* sql`
            INSERT INTO refresh_tokens (learner_id, family_id, token_hash, expires_at, created_at)
            VALUES (${learnerId}, ${family}, ${sha256(token)}, ${new Date(createdAt.getTime() + LIFETIME_MS)}, ${createdAt})`
          return { token, familyId: family }
        }).pipe(Effect.orDie),
      findForUpdate: (token) => findForUpdate(token).pipe(Effect.orDie),
      markUsed: (id) =>
        now.pipe(Effect.flatMap((at) => sql`UPDATE refresh_tokens SET used_at = ${at} WHERE id = ${id}`), Effect.asVoid, Effect.orDie),
      revokeFamily: (familyId) =>
        now.pipe(
          Effect.flatMap((at) =>
            sql`UPDATE refresh_tokens SET revoked_at = ${at} WHERE family_id = ${familyId} AND revoked_at IS NULL`
          ),
          Effect.asVoid,
          Effect.orDie
        )
    })
  })
)
