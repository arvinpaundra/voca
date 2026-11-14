import { Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { LearnerSettings, LearnerSlug } from "@voca/contract"
import { LearnerRecord } from "../domain/learner.ts"
import { LearnerRepo } from "../application/ports.ts"

/** A `learners` row as selected below: flat, columns aliased to camelCase. */
const LearnerRow = Schema.Struct({
  id: Schema.BigIntFromString, // selected as `id::text`: pg returns bigint columns as strings
  slug: LearnerSlug,
  email: Schema.String,
  name: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtcFromDate,
  ...LearnerSettings.fields
})

const toRecord = ({ id, slug, email, name, avatarUrl, createdAt, ...settings }: typeof LearnerRow.Type): LearnerRecord => ({
  id, slug, email, name, avatarUrl, createdAt, settings
})

export const LearnerRepoLive = Layer.effect(
  LearnerRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findBySlug = SqlSchema.findOneOption({
      Request: LearnerSlug,
      Result: LearnerRow,
      execute: (slug) => sql`
        SELECT id::text AS id, slug, email, name, avatar_url AS "avatarUrl", created_at AS "createdAt",
               timezone, day_start_hour AS "dayStartHour", desired_retention AS "desiredRetention",
               new_per_day AS "newPerDay", default_session_size AS "defaultSessionSize", default_mode AS "defaultMode"
        FROM learners WHERE slug = ${slug} AND deleted_at IS NULL`
    })

    const findById = SqlSchema.findOneOption({
      Request: Schema.BigInt,
      Result: LearnerRow,
      execute: (id) => sql`
        SELECT id::text AS id, slug, email, name, avatar_url AS "avatarUrl", created_at AS "createdAt",
               timezone, day_start_hour AS "dayStartHour", desired_retention AS "desiredRetention",
               new_per_day AS "newPerDay", default_session_size AS "defaultSessionSize", default_mode AS "defaultMode"
        FROM learners WHERE id = ${id} AND deleted_at IS NULL`
    })

    return LearnerRepo.of({
      findBySlug: (slug) => findBySlug(slug).pipe(Effect.map(Option.map(toRecord)), Effect.orDie),
      findById: (id) => findById(id).pipe(Effect.map(Option.map(toRecord)), Effect.orDie),
      saveSettings: (id, settings) => sql`
        UPDATE learners SET timezone = ${settings.timezone}, day_start_hour = ${settings.dayStartHour},
          desired_retention = ${settings.desiredRetention}, new_per_day = ${settings.newPerDay},
          default_session_size = ${settings.defaultSessionSize}, default_mode = ${settings.defaultMode}
        WHERE id = ${id}`.pipe(Effect.asVoid, Effect.orDie)
    })
  })
)
