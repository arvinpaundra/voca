import { Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { DeckSlug, Drill } from "@voca/contract"
import {
  InsightRepo,
  type Clock,
  type DayCount,
  type DeckDue,
  type LearnerSettings,
  type Scope
} from "../application/insightRepo.ts"

const Id = Schema.BigIntFromString
const Count = Schema.Number

const ScopeFields = {
  learnerId: Schema.BigInt,
  deckId: Schema.NullOr(Schema.BigInt)
}

const ClockFields = {
  timezone: Schema.String,
  dayStartHour: Schema.Number
}

const SettingsRow = Schema.Struct({
  timezone: Schema.String,
  dayStartHour: Count,
  newPerDay: Count
})

const DeckRow = Schema.Struct({ id: Id })

const DayCountRow = Schema.Struct({ date: Schema.String, count: Count })

const DeckDueRow = Schema.Struct({
  deckSlug: DeckSlug,
  title: Schema.String,
  termLang: Schema.String,
  drill: Drill,
  due: Count,
  overdue: Count,
  hard: Count
})

/**
 * Study dates are computed in SQL as the wall-clock time less the day start hour, then the calendar date:
 * the same rule `studyDay` applies in TypeScript, so both sides name a review's study date alike.
 */
export const InsightRepoLive = Layer.effect(
  InsightRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const settingsOf = SqlSchema.findOne({
      Request: Schema.BigInt,
      Result: SettingsRow,
      execute: (learnerId) => sql`
        SELECT timezone, day_start_hour AS "dayStartHour", new_per_day AS "newPerDay"
        FROM learners WHERE id = ${learnerId} AND deleted_at IS NULL`
    })

    const deckOf = SqlSchema.findOneOption({
      Request: Schema.Struct({ learnerId: Schema.BigInt, deckSlug: Schema.String }),
      Result: DeckRow,
      execute: ({ learnerId, deckSlug }) => sql`
        SELECT id::text AS id FROM decks
        WHERE owner_id = ${learnerId} AND slug = ${deckSlug} AND deleted_at IS NULL`
    })

    const maturityOf = SqlSchema.findOne({
      Request: Schema.Struct({ ...ScopeFields, matureDays: Count }),
      Result: Schema.Struct({ learning: Count, mature: Count }),
      execute: ({ learnerId, deckId, matureDays }) => sql`
        SELECT COUNT(*) FILTER (WHERE c.stability < ${matureDays})::int AS learning,
          COUNT(*) FILTER (WHERE c.stability >= ${matureDays})::int AS mature
        FROM cards c
        JOIN words w ON w.id = c.word_id AND w.deleted_at IS NULL
        JOIN decks d ON d.id = w.deck_id AND d.owner_id = ${learnerId} AND d.deleted_at IS NULL
        WHERE c.learner_id = ${learnerId} AND c.deleted_at IS NULL
          AND (${deckId}::bigint IS NULL OR d.id = ${deckId}::bigint)`
    })

    const unstudiedOf = SqlSchema.findOne({
      Request: Schema.Struct(ScopeFields),
      Result: Schema.Struct({ count: Count }),
      execute: ({ learnerId, deckId }) => sql`
        SELECT COUNT(*)::int AS count
        FROM words w
        JOIN decks d ON d.id = w.deck_id AND d.owner_id = ${learnerId} AND d.deleted_at IS NULL
        CROSS JOIN (VALUES ('term_meaning'), ('meaning_term'), ('term_reading'), ('reading_term')) AS drills(drill)
        WHERE w.deleted_at IS NULL
          AND (${deckId}::bigint IS NULL OR d.id = ${deckId}::bigint)
          AND (drills.drill IN ('term_meaning', 'meaning_term')
            OR (w.reading IS NOT NULL AND w.reading_key <> '' AND w.reading_key <> w.term_key))
          AND NOT EXISTS (
            SELECT 1 FROM cards c
            WHERE c.word_id = w.id AND c.drill = drills.drill AND c.learner_id = ${learnerId}
              AND c.deleted_at IS NULL)`
    })

    const dueOf = SqlSchema.findOne({
      Request: Schema.Struct({
        ...ScopeFields,
        start: Schema.DateTimeUtcFromDate,
        end: Schema.DateTimeUtcFromDate
      }),
      Result: Schema.Struct({ due: Count, overdue: Count }),
      execute: ({ learnerId, deckId, start, end }) => sql`
        SELECT COUNT(*)::int AS due,
          COUNT(*) FILTER (WHERE c.due < ${start})::int AS overdue
        FROM cards c
        JOIN words w ON w.id = c.word_id AND w.deleted_at IS NULL
        JOIN decks d ON d.id = w.deck_id AND d.owner_id = ${learnerId} AND d.deleted_at IS NULL
        WHERE c.learner_id = ${learnerId} AND c.deleted_at IS NULL AND c.due < ${end}
          AND (${deckId}::bigint IS NULL OR d.id = ${deckId}::bigint)`
    })

    const forecastOf = SqlSchema.findAll({
      Request: Schema.Struct({
        ...ScopeFields,
        ...ClockFields,
        from: Schema.String,
        to: Schema.String
      }),
      Result: DayCountRow,
      execute: ({ learnerId, deckId, timezone, dayStartHour, from, to }) => sql`
        SELECT due_days.study_date AS "date", COUNT(*)::int AS count
        FROM (
          SELECT to_char(((c.due AT TIME ZONE ${timezone}::text)
              - make_interval(hours => ${dayStartHour}::int))::date, 'YYYY-MM-DD') AS study_date
          FROM cards c
          JOIN words w ON w.id = c.word_id AND w.deleted_at IS NULL
          JOIN decks d ON d.id = w.deck_id AND d.owner_id = ${learnerId} AND d.deleted_at IS NULL
          WHERE c.learner_id = ${learnerId} AND c.deleted_at IS NULL
            AND (${deckId}::bigint IS NULL OR d.id = ${deckId}::bigint)
        ) due_days
        WHERE due_days.study_date >= ${from} AND due_days.study_date <= ${to}
        GROUP BY due_days.study_date
        ORDER BY due_days.study_date`
    })

    const retentionOf = SqlSchema.findOne({
      Request: Schema.Struct({
        ...ScopeFields,
        ...ClockFields,
        from: Schema.String,
        to: Schema.String
      }),
      Result: Schema.Struct({
        total: Count,
        correct: Count,
        predicted: Schema.NullOr(Schema.Number)
      }),
      execute: ({ learnerId, deckId, timezone, dayStartHour, from, to }) => sql`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE correct)::int AS correct,
          AVG(retrievability)::float8 AS predicted
        FROM (
          SELECT r.correct, r.retrievability,
            to_char(((r.reviewed_at AT TIME ZONE ${timezone}::text)
              - make_interval(hours => ${dayStartHour}::int))::date, 'YYYY-MM-DD') AS study_date
          FROM reviews r
          JOIN words w ON w.id = r.word_id
          WHERE r.learner_id = ${learnerId} AND r.state_before = 'review'
            AND (${deckId}::bigint IS NULL OR w.deck_id = ${deckId}::bigint)
        ) reviewed
        WHERE reviewed.study_date >= ${from} AND reviewed.study_date <= ${to}`
    })

    const reviewDaysOf = SqlSchema.findAll({
      Request: Schema.Struct({
        ...ScopeFields,
        ...ClockFields,
        to: Schema.String
      }),
      Result: DayCountRow,
      execute: ({ learnerId, deckId, timezone, dayStartHour, to }) => sql`
        SELECT reviewed.study_date AS "date", COUNT(*)::int AS count
        FROM (
          SELECT to_char(((r.reviewed_at AT TIME ZONE ${timezone}::text)
              - make_interval(hours => ${dayStartHour}::int))::date, 'YYYY-MM-DD') AS study_date
          FROM reviews r
          JOIN words w ON w.id = r.word_id
          WHERE r.learner_id = ${learnerId}
            AND (${deckId}::bigint IS NULL OR w.deck_id = ${deckId}::bigint)
        ) reviewed
        WHERE reviewed.study_date <= ${to}
        GROUP BY reviewed.study_date
        ORDER BY reviewed.study_date`
    })

    const newOf = SqlSchema.findOne({
      Request: Schema.Struct({
        learnerId: Schema.BigInt,
        from: Schema.DateTimeUtcFromDate,
        to: Schema.DateTimeUtcFromDate
      }),
      Result: Schema.Struct({ count: Count }),
      execute: ({ learnerId, from, to }) => sql`
        SELECT COUNT(*)::int AS count FROM reviews
        WHERE learner_id = ${learnerId} AND state_before = 'new' AND reviewed_at >= ${from} AND reviewed_at < ${to}`
    })

    const dueByDeckOf = SqlSchema.findAll({
      Request: Schema.Struct({
        learnerId: Schema.BigInt,
        start: Schema.DateTimeUtcFromDate,
        end: Schema.DateTimeUtcFromDate
      }),
      Result: DeckDueRow,
      execute: ({ learnerId, start, end }) => sql`
        SELECT d.slug AS "deckSlug", d.title AS title, d.term_lang AS "termLang", c.drill AS drill,
          COUNT(*)::int AS due,
          COUNT(*) FILTER (WHERE c.due < ${start})::int AS overdue,
          COUNT(*) FILTER (WHERE c.is_hard)::int AS hard
        FROM cards c
        JOIN words w ON w.id = c.word_id AND w.deleted_at IS NULL
        JOIN decks d ON d.id = w.deck_id AND d.owner_id = ${learnerId} AND d.deleted_at IS NULL
        WHERE c.learner_id = ${learnerId} AND c.deleted_at IS NULL AND c.due < ${end}
        GROUP BY d.id, d.slug, d.title, d.term_lang, c.drill`
    })

    return InsightRepo.of({
      learnerSettings: (learnerId): Effect.Effect<LearnerSettings> => settingsOf(learnerId).pipe(Effect.orDie),

      findLiveDeck: (learnerId, deckSlug) =>
        deckOf({ learnerId, deckSlug }).pipe(
          Effect.map(Option.map((row) => row.id)),
          Effect.orDie
        ),

      cardMaturity: (scope: Scope, matureDays) =>
        maturityOf({ ...scope, matureDays }).pipe(Effect.orDie),

      unstudiedPairs: (scope: Scope) =>
        unstudiedOf(scope).pipe(
          Effect.map((row) => row.count),
          Effect.orDie
        ),

      dueCounts: (scope: Scope, start, end) =>
        dueOf({ ...scope, start, end }).pipe(Effect.orDie),

      dueForecast: (scope: Scope, clock: Clock, from, to): Effect.Effect<ReadonlyArray<DayCount>> =>
        forecastOf({ ...scope, ...clock, from, to }).pipe(Effect.orDie),

      reviewStats: (scope: Scope, clock: Clock, from, to) =>
        retentionOf({ ...scope, ...clock, from, to }).pipe(Effect.orDie),

      reviewDays: (scope: Scope, clock: Clock, to): Effect.Effect<ReadonlyArray<DayCount>> =>
        reviewDaysOf({ ...scope, ...clock, to }).pipe(Effect.orDie),

      newReviewsBetween: (learnerId, from, to) =>
        newOf({ learnerId, from, to }).pipe(
          Effect.map((row) => row.count),
          Effect.orDie
        ),

      dueByDeck: (learnerId, start, end): Effect.Effect<ReadonlyArray<DeckDue>> =>
        dueByDeckOf({ learnerId, start, end }).pipe(Effect.orDie)
    })
  })
)
