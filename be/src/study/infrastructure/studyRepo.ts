import { DateTime, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Drill, DrillSet, LangTag, Mode, SessionSize, SessionSlug, SessionStatus, WordSlug } from "@voca/contract"
import {
  StudyRepo,
  type AnswerRecord,
  type CardState,
  type CardWrite,
  type NewQuestion,
  type NewSession,
  type OwnedDeck,
  type PendingQuestion,
  type QuestionRecord,
  type ReviewWrite,
  type SessionRecord
} from "../application/studyRepo.ts"

const Id = Schema.BigIntFromString
const Count = Schema.Number

const SettingsRow = Schema.Struct({
  timezone: Schema.String,
  dayStartHour: Schema.Number,
  desiredRetention: Schema.Number,
  newPerDay: Schema.Number
})

const OwnedDeckRow = Schema.Struct({ id: Id, termLang: LangTag })

const WordRow = Schema.Struct({
  id: Id,
  slug: WordSlug,
  term: Schema.String,
  reading: Schema.NullOr(Schema.String),
  meaning: Schema.String,
  termKey: Schema.String,
  readingKey: Schema.String,
  meaningKey: Schema.String
})

const DeckCardRow = Schema.Struct({
  wordId: Id,
  drill: Drill,
  due: Schema.DateTimeUtcFromDate
})

const CardRow = Schema.Struct({
  stability: Schema.Number,
  difficulty: Schema.Number,
  lastReview: Schema.DateTimeUtcFromDate,
  reps: Schema.Number,
  lapses: Schema.Number
})

const SessionRow = Schema.Struct({
  id: Id,
  slug: SessionSlug,
  deckId: Id,
  termLang: LangTag,
  drills: DrillSet,
  mode: Mode,
  size: SessionSize,
  status: SessionStatus
})

const QuestionRow = Schema.Struct({
  id: Id,
  wordId: Id,
  drill: Drill,
  attempt: Count,
  optionIds: Schema.Array(Id),
  answered: Schema.Boolean
})

const PendingRow = Schema.Struct({
  position: Count,
  attempt: Count,
  drill: Drill,
  wordId: Id,
  optionIds: Schema.Array(Id)
})

/** A failing statement is a defect: the ports have no error channel for database errors, so calls end in `orDie`. */
export const StudyRepoLive = Layer.effect(
  StudyRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const settingsOf = SqlSchema.findOne({
      Request: Schema.BigInt,
      Result: SettingsRow,
      execute: (learnerId) => sql`
        SELECT timezone, day_start_hour AS "dayStartHour", desired_retention AS "desiredRetention",
               new_per_day AS "newPerDay"
        FROM learners WHERE id = ${learnerId} AND deleted_at IS NULL`
    })

    const deckOf = SqlSchema.findOneOption({
      Request: Schema.Struct({ learnerId: Schema.BigInt, deckSlug: Schema.String }),
      Result: OwnedDeckRow,
      execute: ({ learnerId, deckSlug }) => sql`
        SELECT id::text AS id, term_lang AS "termLang"
        FROM decks WHERE owner_id = ${learnerId} AND slug = ${deckSlug} AND deleted_at IS NULL`
    })

    const wordsOf = SqlSchema.findAll({
      Request: Schema.BigInt,
      Result: WordRow,
      execute: (deckId) => sql`
        SELECT id::text AS id, slug, term, reading, meaning, term_key AS "termKey", reading_key AS "readingKey",
               meaning_key AS "meaningKey"
        FROM words WHERE deck_id = ${deckId} AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`
    })

    const wordsById = SqlSchema.findAll({
      Request: Schema.Array(Schema.BigInt),
      Result: WordRow,
      execute: (ids) => sql`
        SELECT id::text AS id, slug, term, reading, meaning, term_key AS "termKey", reading_key AS "readingKey",
               meaning_key AS "meaningKey"
        FROM words WHERE id IN ${sql.in(ids)}`
    })

    const cardsOfDeck = SqlSchema.findAll({
      Request: Schema.Struct({ learnerId: Schema.BigInt, deckId: Schema.BigInt }),
      Result: DeckCardRow,
      execute: ({ learnerId, deckId }) => sql`
        SELECT c.word_id::text AS "wordId", c.drill, c.due
        FROM cards c JOIN words w ON w.id = c.word_id
        WHERE c.learner_id = ${learnerId} AND w.deck_id = ${deckId}
          AND c.deleted_at IS NULL AND w.deleted_at IS NULL`
    })

    const newReviews = SqlSchema.findOne({
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

    const cardOf = SqlSchema.findOneOption({
      Request: Schema.Struct({ learnerId: Schema.BigInt, wordId: Schema.BigInt, drill: Drill }),
      Result: CardRow,
      execute: ({ learnerId, wordId, drill }) => sql`
        SELECT stability, difficulty, last_review AS "lastReview", reps, lapses
        FROM cards WHERE learner_id = ${learnerId} AND word_id = ${wordId} AND drill = ${drill}
          AND deleted_at IS NULL`
    })

    const activeSessionOf = SqlSchema.findOneOption({
      Request: Schema.BigInt,
      Result: SessionRow,
      execute: (learnerId) => sql`
        SELECT s.id::text AS id, s.slug, s.scope_deck_id::text AS "deckId", d.term_lang AS "termLang",
               s.drills, s.mode, s.size, s.status
        FROM study_sessions s JOIN decks d ON d.id = s.scope_deck_id
        WHERE s.learner_id = ${learnerId} AND s.status = 'active'`
    })

    const ownedSessionOf = SqlSchema.findOneOption({
      Request: Schema.Struct({ learnerId: Schema.BigInt, slug: Schema.String }),
      Result: SessionRow,
      execute: ({ learnerId, slug }) => sql`
        SELECT s.id::text AS id, s.slug, s.scope_deck_id::text AS "deckId", d.term_lang AS "termLang",
               s.drills, s.mode, s.size, s.status
        FROM study_sessions s JOIN decks d ON d.id = s.scope_deck_id
        WHERE s.slug = ${slug} AND s.learner_id = ${learnerId}
        FOR UPDATE OF s`
    })

    const questionAt = SqlSchema.findOneOption({
      Request: Schema.Struct({ sessionId: Schema.BigInt, position: Schema.Number }),
      Result: QuestionRow,
      execute: ({ sessionId, position }) => sql`
        SELECT id::text AS id, word_id::text AS "wordId", drill, attempt, option_ids::text[] AS "optionIds",
               (answered_at IS NOT NULL) AS answered
        FROM session_questions WHERE session_id = ${sessionId} AND position = ${position}
        FOR UPDATE`
    })

    const pendingOf = SqlSchema.findAll({
      Request: Schema.BigInt,
      Result: PendingRow,
      execute: (sessionId) => sql`
        SELECT position, attempt, drill, word_id::text AS "wordId", option_ids::text[] AS "optionIds"
        FROM session_questions WHERE session_id = ${sessionId} AND answered_at IS NULL
        ORDER BY position ASC`
    })

    const maxPositionOf = SqlSchema.findOne({
      Request: Schema.BigInt,
      Result: Schema.Struct({ position: Count }),
      execute: (sessionId) => sql`
        SELECT COALESCE(MAX(position), 0)::int AS position FROM session_questions WHERE session_id = ${sessionId}`
    })

    const clearedOf = SqlSchema.findOne({
      Request: Schema.BigInt,
      Result: Schema.Struct({ count: Count }),
      execute: (sessionId) => sql`
        SELECT COUNT(DISTINCT word_id)::int AS count FROM session_questions
        WHERE session_id = ${sessionId} AND correct = true`
    })

    const insertedSession = SqlSchema.findOne({
      Request: Schema.Struct({
        learnerId: Schema.BigInt,
        deckId: Schema.BigInt,
        slug: Schema.String,
        drills: Schema.Array(Schema.String),
        mode: Schema.String,
        size: Count,
        createdAt: Schema.DateTimeUtcFromDate
      }),
      Result: Schema.Struct({ id: Id }),
      execute: (session) => sql`
        INSERT INTO study_sessions ${sql.insert({
          slug: session.slug,
          learner_id: session.learnerId,
          scope_deck_id: session.deckId,
          drills: session.drills,
          mode: session.mode,
          size: session.size,
          status: "active",
          created_at: session.createdAt
        })}
        RETURNING id::text AS id`
    })

    return StudyRepo.of({
      learnerSettings: (learnerId) => settingsOf(learnerId).pipe(Effect.orDie),

      findOwnedDeck: (learnerId, deckSlug) =>
        deckOf({ learnerId, deckSlug }).pipe(
          Effect.map(Option.map((row): OwnedDeck => ({ id: row.id, termLang: row.termLang }))),
          Effect.orDie
        ),

      deckWords: (deckId) => wordsOf(deckId).pipe(Effect.orDie),

      deckCards: (learnerId, deckId) => cardsOfDeck({ learnerId, deckId }).pipe(Effect.orDie),

      newReviewsBetween: (learnerId, from, to) =>
        newReviews({ learnerId, from, to }).pipe(
          Effect.map((row) => row.count),
          Effect.orDie
        ),

      findCard: (learnerId, wordId, drill) =>
        cardOf({ learnerId, wordId, drill }).pipe(
          Effect.map(Option.map((row): CardState => row)),
          Effect.orDie
        ),

      saveCard: (learnerId, wordId, drill, card: CardWrite) =>
        sql`
          INSERT INTO cards ${sql.insert({
            word_id: wordId,
            drill,
            learner_id: learnerId,
            stability: card.stability,
            difficulty: card.difficulty,
            due: DateTime.toDateUtc(card.due),
            last_review: DateTime.toDateUtc(card.lastReview),
            reps: card.reps,
            lapses: card.lapses,
            is_hard: false
          })}
          ON CONFLICT (word_id, drill) WHERE deleted_at IS NULL
          DO UPDATE SET stability = EXCLUDED.stability, difficulty = EXCLUDED.difficulty, due = EXCLUDED.due,
            last_review = EXCLUDED.last_review, reps = EXCLUDED.reps, lapses = EXCLUDED.lapses`.pipe(
          Effect.asVoid,
          Effect.orDie
        ),

      insertReview: (learnerId, review: ReviewWrite) =>
        sql`
          INSERT INTO reviews ${sql.insert({
            word_id: review.wordId,
            drill: review.drill,
            learner_id: learnerId,
            session_id: review.sessionId,
            reviewed_at: DateTime.toDateUtc(review.reviewedAt),
            rating: review.rating,
            correct: review.correct,
            mode: review.mode,
            latency_ms: review.latencyMs,
            chosen_word_id: review.chosenWordId,
            state_before: review.stateBefore,
            elapsed_days: review.elapsedDays,
            retrievability: review.retrievability,
            stability_before: review.stabilityBefore,
            difficulty_before: review.difficultyBefore,
            stability_after: review.stabilityAfter,
            difficulty_after: review.difficultyAfter,
            scheduled_days: review.scheduledDays
          })}`.pipe(Effect.asVoid, Effect.orDie),

      findActiveSession: (learnerId) =>
        activeSessionOf(learnerId).pipe(
          Effect.map(Option.map((row): SessionRecord => row)),
          Effect.orDie
        ),

      lockOwnedSession: (learnerId, sessionSlug) =>
        ownedSessionOf({ learnerId, slug: sessionSlug }).pipe(
          Effect.map(Option.map((row): SessionRecord => row)),
          Effect.orDie
        ),

      setSessionStatus: (sessionId, status, at) =>
        sql`
          UPDATE study_sessions SET status = ${status}, ended_at = ${DateTime.toDateUtc(at)}
          WHERE id = ${sessionId}`.pipe(
          Effect.asVoid,
          Effect.orDie
        ),

      insertSession: (learnerId, session: NewSession) =>
        insertedSession({
          learnerId,
          deckId: session.deckId,
          slug: session.slug,
          drills: [...session.drills],
          mode: session.mode,
          size: session.size,
          createdAt: session.createdAt
        }).pipe(
          Effect.map((row) => row.id),
          Effect.orDie
        ),

      insertQuestion: (sessionId, question: NewQuestion) =>
        sql`
          INSERT INTO session_questions (session_id, position, word_id, drill, attempt, option_ids)
          VALUES (${sessionId}, ${question.position}, ${question.wordId}, ${question.drill}, ${question.attempt},
            ${question.optionIds.map(String)}::bigint[])`.pipe(Effect.asVoid, Effect.orDie),

      lockQuestion: (sessionId, position) =>
        questionAt({ sessionId, position }).pipe(
          Effect.map(Option.map((row): QuestionRecord => row)),
          Effect.orDie
        ),

      recordAnswer: (questionId, answer: AnswerRecord) =>
        sql`
          UPDATE session_questions SET ${sql.update({
            answered_at: DateTime.toDateUtc(answer.at),
            chosen_word_id: answer.chosenWordId,
            correct: answer.correct,
            latency_ms: answer.latencyMs
          })}
          WHERE id = ${questionId}`.pipe(Effect.asVoid, Effect.orDie),

      pendingQuestions: (sessionId): Effect.Effect<ReadonlyArray<PendingQuestion>> =>
        pendingOf(sessionId).pipe(Effect.orDie),

      maxPosition: (sessionId) => maxPositionOf(sessionId).pipe(Effect.map((row) => row.position), Effect.orDie),

      clearedCount: (sessionId) => clearedOf(sessionId).pipe(Effect.map((row) => row.count), Effect.orDie),

      wordsByIds: (ids) => (ids.length === 0 ? Effect.succeed([]) : wordsById([...ids]).pipe(Effect.orDie))
    })
  })
)
