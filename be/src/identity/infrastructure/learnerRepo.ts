import { Clock, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { LearnerSettings, LearnerSlug, SLUG_LENGTH, slug } from "@voca/contract"
import { LearnerRecord } from "../domain/learner.ts"
import { LearnerRepo } from "../application/ports.ts"

/** ADR 28: the settings a new Learner starts with. The timezone comes from the sign-in request. */
const NEW_LEARNER = { dayStartHour: 4, desiredRetention: 0.9, newPerDay: 20, defaultSessionSize: 10, defaultMode: "easy" }

const NewGoogleLearner = Schema.Struct({
  slug: Schema.String,
  googleSub: Schema.String,
  email: Schema.String,
  name: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
  timezone: Schema.String,
  createdAt: Schema.Number // epoch millis, from Clock
})

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

    // One statement: the partial unique index on google_sub (WHERE deleted_at IS NULL) makes a soft-deleted account invisible
    // to the conflict, so its Google sub gets a fresh Learner. Settings are never touched on update.
    const insertGoogle = SqlSchema.findOne({
      Request: NewGoogleLearner,
      Result: LearnerRow,
      execute: (learner) => sql`
        INSERT INTO learners (slug, google_sub, email, name, avatar_url, timezone, day_start_hour, desired_retention,
          new_per_day, default_session_size, default_mode, created_at)
        VALUES (${learner.slug}, ${learner.googleSub}, ${learner.email}, ${learner.name}, ${learner.avatarUrl},
          ${learner.timezone}, ${NEW_LEARNER.dayStartHour}, ${NEW_LEARNER.desiredRetention}, ${NEW_LEARNER.newPerDay},
          ${NEW_LEARNER.defaultSessionSize}, ${NEW_LEARNER.defaultMode}, ${new Date(learner.createdAt)})
        ON CONFLICT (google_sub) WHERE deleted_at IS NULL
        DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
        RETURNING id::text AS id, slug, email, name, avatar_url AS "avatarUrl", created_at AS "createdAt",
          timezone, day_start_hour AS "dayStartHour", desired_retention AS "desiredRetention",
          new_per_day AS "newPerDay", default_session_size AS "defaultSessionSize", default_mode AS "defaultMode"`
    })

    const newSlug = () => slug(crypto.getRandomValues(new Uint8Array(SLUG_LENGTH.learner)))

    return LearnerRepo.of({
      findBySlug: (slug) => findBySlug(slug).pipe(Effect.map(Option.map(toRecord)), Effect.orDie),
      findById: (id) => findById(id).pipe(Effect.map(Option.map(toRecord)), Effect.orDie),
      upsertGoogle: (profile, timezone) =>
        Effect.gen(function* () {
          const createdAt = yield* Clock.currentTimeMillis
          const attempt = (slugValue: string) =>
            insertGoogle({
              slug: slugValue,
              googleSub: profile.sub,
              email: profile.email,
              name: profile.name,
              avatarUrl: profile.avatarUrl,
              timezone,
              createdAt
            }).pipe(sql.withTransaction) // a savepoint inside the caller's transaction, so a slug clash can be retried
          return yield* attempt(newSlug()).pipe(
            Effect.catchTag("SqlError", (error) =>
              error.reason._tag === "UniqueViolation" ? attempt(newSlug()) : Effect.fail(error)
            ),
            Effect.map(toRecord),
            Effect.orDie
          )
        }),
      saveSettings: (id, settings) => sql`
        UPDATE learners SET timezone = ${settings.timezone}, day_start_hour = ${settings.dayStartHour},
          desired_retention = ${settings.desiredRetention}, new_per_day = ${settings.newPerDay},
          default_session_size = ${settings.defaultSessionSize}, default_mode = ${settings.defaultMode}
        WHERE id = ${id}`.pipe(Effect.asVoid, Effect.orDie)
    })
  })
)
