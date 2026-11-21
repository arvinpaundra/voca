import { DateTime, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { DeckSlug, Drill, Example, Meaning, Mode, Notes, Rating, Reading, Term, WordSlug } from "@voca/contract"
import {
  InsightRepo,
  type Clock,
  type DayCount,
  type DeckDue,
  type LearnerSettings,
  type OwnedWord,
  type PickedWord,
  type Scope,
  type WordAttemptRow,
  type WordCardRow,
  type WordReviewRow
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

const OwnedWordRow = Schema.Struct({
  id: Id,
  termLang: Schema.String,
  slug: WordSlug,
  term: Term,
  reading: Schema.NullOr(Reading),
  meaning: Meaning,
  example: Schema.NullOr(Example),
  notes: Schema.NullOr(Notes),
  createdAt: Schema.DateTimeUtcFromDate
})

const WordCardDbRow = Schema.Struct({
  drill: Drill,
  stability: Schema.Number,
  difficulty: Schema.Number,
  due: Schema.DateTimeUtcFromDate,
  lastReview: Schema.DateTimeUtcFromDate,
  reps: Count,
  lapses: Count,
  isHard: Schema.Boolean
})

const WordReviewDbRow = Schema.Struct({
  drill: Drill,
  reviewedAt: Schema.DateTimeUtcFromDate,
  rating: Rating,
  correct: Schema.Boolean,
  mode: Mode,
  latencyMs: Count,
  predictedRecall: Schema.NullOr(Schema.Number),
  scheduledDays: Count
})

const WordAttemptDbRow = Schema.Struct({
  sessionId: Id,
  drill: Drill,
  correct: Schema.Boolean,
  chosenWordId: Schema.NullOr(Id)
})

const PickedWordRow = Schema.Struct({ id: Id, slug: WordSlug, term: Schema.String })

const SessionPaceRow = Schema.Struct({ secondsPerCard: Count })

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
      Request: Schema.Struct({
        ...ScopeFields,
        awakeAt: Schema.NullOr(Schema.DateTimeUtcFromDate)
      }),
      Result: Schema.Struct({ count: Count }),
      execute: ({ learnerId, deckId, awakeAt }) => sql`
        SELECT COUNT(*)::int AS count
        FROM words w
        JOIN decks d ON d.id = w.deck_id AND d.owner_id = ${learnerId} AND d.deleted_at IS NULL
        CROSS JOIN (VALUES ('term_meaning'), ('meaning_term'), ('term_reading'), ('reading_term')) AS drills(drill)
        WHERE w.deleted_at IS NULL
          AND (${deckId}::bigint IS NULL OR d.id = ${deckId}::bigint)
          AND (${awakeAt}::timestamptz IS NULL
            OR d.snoozed_at IS NULL
            OR (d.snoozed_until IS NOT NULL AND d.snoozed_until <= ${awakeAt}::timestamptz))
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

    const ownedWordOf = SqlSchema.findOneOption({
      Request: Schema.Struct({ learnerId: Schema.BigInt, wordSlug: Schema.String }),
      Result: OwnedWordRow,
      execute: ({ learnerId, wordSlug }) => sql`
        SELECT w.id::text AS id, d.term_lang AS "termLang", w.slug, w.term, w.reading, w.meaning, w.example,
          w.notes, w.created_at AS "createdAt"
        FROM words w
        JOIN decks d ON d.id = w.deck_id AND d.owner_id = ${learnerId} AND d.deleted_at IS NULL
        WHERE w.slug = ${wordSlug} AND w.deleted_at IS NULL`
    })

    const wordCardsOf = SqlSchema.findAll({
      Request: Schema.Struct({ learnerId: Schema.BigInt, wordId: Schema.BigInt }),
      Result: WordCardDbRow,
      execute: ({ learnerId, wordId }) => sql`
        SELECT c.drill, c.stability, c.difficulty, c.due, c.last_review AS "lastReview", c.reps, c.lapses,
          c.is_hard AS "isHard"
        FROM cards c
        WHERE c.word_id = ${wordId} AND c.learner_id = ${learnerId} AND c.deleted_at IS NULL
        ORDER BY c.drill`
    })

    const wordReviewsOf = SqlSchema.findAll({
      Request: Schema.Struct({ learnerId: Schema.BigInt, wordId: Schema.BigInt }),
      Result: WordReviewDbRow,
      execute: ({ learnerId, wordId }) => sql`
        SELECT r.drill, r.reviewed_at AS "reviewedAt", r.rating, r.correct, r.mode, r.latency_ms AS "latencyMs",
          r.retrievability::float8 AS "predictedRecall", r.scheduled_days AS "scheduledDays"
        FROM reviews r
        WHERE r.word_id = ${wordId} AND r.learner_id = ${learnerId}
        ORDER BY r.reviewed_at DESC, r.id DESC`
    })

    const wordAttemptsOf = SqlSchema.findAll({
      Request: Schema.Struct({ learnerId: Schema.BigInt, wordId: Schema.BigInt }),
      Result: WordAttemptDbRow,
      execute: ({ learnerId, wordId }) => sql`
        SELECT q.session_id::text AS "sessionId", q.drill, q.correct, q.chosen_word_id::text AS "chosenWordId"
        FROM session_questions q
        JOIN study_sessions s ON s.id = q.session_id AND s.learner_id = ${learnerId}
        WHERE q.word_id = ${wordId} AND q.answered_at IS NOT NULL AND q.correct IS NOT NULL
        ORDER BY s.created_at DESC, s.id DESC, q.attempt ASC`
    })

    const pickedWordsOf = SqlSchema.findAll({
      Request: Schema.Array(Schema.BigInt),
      Result: PickedWordRow,
      execute: (ids) => sql`
        SELECT w.id::text AS id, w.slug, w.term FROM words w WHERE w.id = ANY(${ids}::bigint[])`
    })

    const dueByDeckOf = SqlSchema.findAll({
      Request: Schema.Struct({
        learnerId: Schema.BigInt,
        start: Schema.DateTimeUtcFromDate,
        end: Schema.DateTimeUtcFromDate,
        now: Schema.DateTimeUtcFromDate
      }),
      Result: DeckDueRow,
      execute: ({ learnerId, start, end, now }) => sql`
        SELECT d.slug AS "deckSlug", d.title AS title, d.term_lang AS "termLang", c.drill AS drill,
          COUNT(*)::int AS due,
          COUNT(*) FILTER (WHERE c.due < ${start})::int AS overdue,
          COUNT(*) FILTER (WHERE c.is_hard)::int AS hard
        FROM cards c
        JOIN words w ON w.id = c.word_id AND w.deleted_at IS NULL
        JOIN decks d ON d.id = w.deck_id AND d.owner_id = ${learnerId} AND d.deleted_at IS NULL
        WHERE c.learner_id = ${learnerId} AND c.deleted_at IS NULL AND c.due < ${end}
          AND (d.snoozed_at IS NULL
            OR (d.snoozed_until IS NOT NULL AND d.snoozed_until <= ${now}::timestamptz))
        GROUP BY d.id, d.slug, d.title, d.term_lang, c.drill`
    })

    const sessionPacesOf = SqlSchema.findAll({
      Request: Schema.Struct({ learnerId: Schema.BigInt }),
      Result: SessionPaceRow,
      execute: ({ learnerId }) => sql`
        SELECT (EXTRACT(epoch FROM max(r.reviewed_at) - min(r.reviewed_at)) / (count(*) - 1))::float8
          AS "secondsPerCard"
        FROM reviews r
        WHERE r.learner_id = ${learnerId} AND r.session_id IS NOT NULL
        GROUP BY r.session_id
        HAVING count(*) > 1
        ORDER BY max(r.reviewed_at) DESC
        LIMIT 20`
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

      unstudiedPairs: (scope: Scope, awakeAt?: DateTime.Utc) =>
        unstudiedOf({ ...scope, awakeAt: awakeAt ?? null }).pipe(
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

      findOwnedWord: (learnerId, wordSlug) =>
        ownedWordOf({ learnerId, wordSlug }).pipe(
          Effect.map(
            Option.map(
              (row): OwnedWord => ({
                id: row.id,
                termLang: row.termLang,
                word: {
                  slug: row.slug,
                  term: row.term,
                  reading: row.reading,
                  meaning: row.meaning,
                  example: row.example,
                  notes: row.notes,
                  createdAt: row.createdAt
                }
              })
            )
          ),
          Effect.orDie
        ),

      wordCards: (learnerId, wordId): Effect.Effect<ReadonlyArray<WordCardRow>> =>
        wordCardsOf({ learnerId, wordId }).pipe(Effect.orDie),

      wordReviews: (learnerId, wordId): Effect.Effect<ReadonlyArray<WordReviewRow>> =>
        wordReviewsOf({ learnerId, wordId }).pipe(Effect.orDie),

      wordAttempts: (learnerId, wordId): Effect.Effect<ReadonlyArray<WordAttemptRow>> =>
        wordAttemptsOf({ learnerId, wordId }).pipe(Effect.orDie),

      pickedWords: (ids): Effect.Effect<ReadonlyArray<PickedWord>> =>
        ids.length === 0 ? Effect.succeed([]) : pickedWordsOf(ids).pipe(Effect.orDie),

      dueByDeck: (learnerId, start, end, now): Effect.Effect<ReadonlyArray<DeckDue>> =>
        dueByDeckOf({ learnerId, start, end, now }).pipe(Effect.orDie),

      sessionPaces: (learnerId): Effect.Effect<ReadonlyArray<number>> =>
        sessionPacesOf({ learnerId }).pipe(
          Effect.map((rows) => rows.map((row) => row.secondsPerCard)),
          Effect.orDie
        )
    })
  })
)
