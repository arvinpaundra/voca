import { Array as Arr, DateTime, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Example, Meaning, Notes, Reading, Term, WordCard, WordSlug } from "@voca/contract"
import type { Word, WordWithCards } from "@voca/contract"
import { WordRepo } from "../application/wordRepo.ts"
import type {
  NewWord,
  OwnedWord,
  WordChanges,
  WordCopy,
  WordPage,
  WordQuery
} from "../application/wordRepo.ts"
import { decodeCursor, encodeCursor } from "../../shared/cursor.ts"

/** A `words` row as selected below: `id::text`, columns aliased to camelCase. */
const WordRow = Schema.Struct({
  id: Schema.BigIntFromString,
  slug: WordSlug,
  term: Term,
  reading: Schema.NullOr(Reading),
  meaning: Meaning,
  example: Schema.NullOr(Example),
  notes: Schema.NullOr(Notes),
  createdAt: Schema.DateTimeUtcFromDate
})

const WordWithCardsRow = Schema.Struct({
  ...WordRow.fields,
  cards: Schema.Array(WordCard)
})

const OwnedWordRow = Schema.Struct({
  ...WordRow.fields,
  deckId: Schema.BigIntFromString
})

/** The sort values of the last word on a page: its creation time and its slug. */
const WordKeyset = Schema.Struct({
  createdAt: Schema.Number,
  slug: Schema.String
})

const toWord = (row: typeof WordRow.Type): Word => {
  return {
    slug: row.slug,
    term: row.term,
    reading: row.reading,
    meaning: row.meaning,
    example: row.example,
    notes: row.notes,
    createdAt: row.createdAt
  }
}

const toWordWithCards = (row: typeof WordWithCardsRow.Type): WordWithCards => {
  return { ...toWord(row), cards: row.cards }
}

/** Column names for the changed fields only; `null` clears a column. */
const wordColumns = (changes: WordChanges): Record<string, string | null> => {
  const columns: Record<string, string | null> = {}

  if (changes.term !== undefined) {
    columns.term = changes.term
  }

  if (changes.termKey !== undefined) {
    columns.term_key = changes.termKey
  }

  if (changes.meaning !== undefined) {
    columns.meaning = changes.meaning
  }

  if (changes.meaningKey !== undefined) {
    columns.meaning_key = changes.meaningKey
  }

  if (changes.reading !== undefined) {
    columns.reading = changes.reading
  }

  if (changes.readingKey !== undefined) {
    columns.reading_key = changes.readingKey
  }

  if (changes.example !== undefined) {
    columns.example = changes.example
  }

  if (changes.notes !== undefined) {
    columns.notes = changes.notes
  }

  return columns
}

export const WordRepoLive = Layer.effect(
  WordRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findDeckId = SqlSchema.findOneOption({
      Request: Schema.Struct({ learnerId: Schema.BigInt, deckSlug: Schema.String }),
      Result: Schema.Struct({ id: Schema.BigIntFromString }),
      execute: ({ learnerId, deckSlug }) => sql`
        SELECT id::text AS id FROM decks
        WHERE owner_id = ${learnerId} AND slug = ${deckSlug} AND deleted_at IS NULL`
    })

    const findOwnedRow = SqlSchema.findOneOption({
      Request: Schema.Struct({ learnerId: Schema.BigInt, wordSlug: Schema.String }),
      Result: OwnedWordRow,
      execute: ({ learnerId, wordSlug }) => sql`
        SELECT w.id::text AS id, w.deck_id::text AS "deckId", w.slug, w.term, w.reading, w.meaning, w.example,
               w.notes, w.created_at AS "createdAt"
        FROM words w JOIN decks d ON d.id = w.deck_id
        WHERE w.slug = ${wordSlug} AND d.owner_id = ${learnerId} AND w.deleted_at IS NULL AND d.deleted_at IS NULL`
    })

    // The caller's live cards come back as one JSON array per word, so one statement serves the whole page.
    // `after` is the keyset: the row comparison makes the page continue strictly after the cursor's word.
    const listRows = SqlSchema.findAll({
      Request: Schema.Struct({
        learnerId: Schema.BigInt,
        deckId: Schema.BigInt,
        q: Schema.NullOr(Schema.String),
        after: Schema.NullOr(WordKeyset),
        limit: Schema.Number
      }),
      Result: WordWithCardsRow,
      execute: ({ learnerId, deckId, q, after, limit }) => {
        const afterAt = after === null ? null : new Date(after.createdAt)
        const afterSlug = after === null ? null : after.slug

        return sql`
          SELECT w.id::text AS id, w.slug, w.term, w.reading, w.meaning, w.example, w.notes,
                 w.created_at AS "createdAt",
                 COALESCE((
                   SELECT json_agg(json_build_object('drill', c.drill, 'due', c.due,
                                                     'stabilityDays', c.stability, 'isHard', c.is_hard))
                   FROM cards c
                   WHERE c.word_id = w.id AND c.learner_id = ${learnerId} AND c.deleted_at IS NULL
                 ), '[]'::json) AS cards
          FROM words w
          WHERE w.deck_id = ${deckId} AND w.deleted_at IS NULL
            AND (${q}::text IS NULL
                 OR strpos(w.term_key, ${q}::text) > 0
                 OR strpos(w.reading_key, ${q}::text) > 0
                 OR strpos(w.meaning_key, ${q}::text) > 0)
            AND (${afterAt}::timestamptz IS NULL
                 OR (w.created_at, w.id)
                    > (${afterAt}::timestamptz, (SELECT a.id FROM words a WHERE a.slug = ${afterSlug}::text)))
          ORDER BY w.created_at ASC, w.id ASC
          LIMIT ${limit}`
      }
    })

    const insertRow = SqlSchema.findOneOption({
      Request: Schema.Struct({
        deckId: Schema.BigInt,
        slug: Schema.String,
        term: Schema.String,
        termKey: Schema.String,
        reading: Schema.NullOr(Schema.String),
        readingKey: Schema.String,
        meaning: Schema.String,
        meaningKey: Schema.String,
        example: Schema.NullOr(Schema.String),
        notes: Schema.NullOr(Schema.String),
        createdAt: Schema.Number
      }),
      Result: WordRow,
      execute: (word) => sql`
        INSERT INTO words ${sql.insert({
          slug: word.slug,
          deck_id: word.deckId,
          term: word.term,
          reading: word.reading,
          meaning: word.meaning,
          example: word.example,
          notes: word.notes,
          term_key: word.termKey,
          reading_key: word.readingKey,
          meaning_key: word.meaningKey,
          created_at: new Date(word.createdAt)
        })}
        ON CONFLICT (deck_id, term_key, reading_key) WHERE deleted_at IS NULL DO NOTHING
        RETURNING id::text AS id, slug, term, reading, meaning, example, notes, created_at AS "createdAt"`
    })

    const updateRow = SqlSchema.findOneOption({
      Request: Schema.Struct({
        wordId: Schema.BigInt,
        columns: Schema.Record(Schema.String, Schema.NullOr(Schema.String))
      }),
      Result: WordRow,
      execute: ({ wordId, columns }) => sql`
        UPDATE words SET ${sql.update(columns)}
        WHERE id = ${wordId} AND deleted_at IS NULL
        RETURNING id::text AS id, slug, term, reading, meaning, example, notes, created_at AS "createdAt"`
    })

    const previewRows = SqlSchema.findAll({
      Request: Schema.Struct({ deckId: Schema.BigInt, limit: Schema.Number }),
      Result: WordRow,
      execute: ({ deckId, limit }) => sql`
        SELECT w.id::text AS id, w.slug, w.term, w.reading, w.meaning, w.example, w.notes,
               w.created_at AS "createdAt"
        FROM words w
        WHERE w.deck_id = ${deckId} AND w.deleted_at IS NULL
        ORDER BY w.created_at ASC, w.id ASC
        LIMIT ${limit}`
    })

    const liveWordRows = SqlSchema.findAll({
      Request: Schema.BigInt,
      Result: WordRow,
      execute: (deckId) => sql`
        SELECT w.id::text AS id, w.slug, w.term, w.reading, w.meaning, w.example, w.notes,
               w.created_at AS "createdAt"
        FROM words w
        WHERE w.deck_id = ${deckId} AND w.deleted_at IS NULL
        ORDER BY w.created_at ASC, w.id ASC`
    })

    const takenKeyRows = SqlSchema.findAll({
      Request: Schema.Struct({
        deckId: Schema.BigInt,
        termKeys: Schema.Array(Schema.String),
        readingKeys: Schema.Array(Schema.String)
      }),
      Result: Schema.Struct({
        termKey: Schema.String,
        readingKey: Schema.String
      }),
      execute: ({ deckId, termKeys, readingKeys }) => sql`
        SELECT DISTINCT w.term_key AS "termKey", w.reading_key AS "readingKey"
        FROM unnest(${termKeys}::text[], ${readingKeys}::text[]) AS k(term_key, reading_key)
        JOIN words w ON w.term_key = k.term_key AND w.reading_key = k.reading_key
        WHERE w.deck_id = ${deckId} AND w.deleted_at IS NULL`
    })

    const liveRows = SqlSchema.findAll({
      Request: Schema.BigInt,
      Result: Schema.Struct({
        term: Schema.String,
        reading: Schema.NullOr(Schema.String),
        meaning: Schema.String,
        example: Schema.NullOr(Schema.String),
        notes: Schema.NullOr(Schema.String),
        termKey: Schema.String,
        readingKey: Schema.String,
        meaningKey: Schema.String
      }),
      execute: (deckId) => sql`
        SELECT term, reading, meaning, example, notes, term_key AS "termKey", reading_key AS "readingKey",
               meaning_key AS "meaningKey"
        FROM words
        WHERE deck_id = ${deckId} AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`
    })

    return WordRepo.of({
      findOwnedDeckId: (learnerId, deckSlug) =>
        findDeckId({ learnerId, deckSlug }).pipe(
          Effect.map(Option.map((row) => row.id)),
          Effect.orDie
        ),

      findOwned: (learnerId, wordSlug) =>
        findOwnedRow({ learnerId, wordSlug }).pipe(
          Effect.map(Option.map((row): OwnedWord => ({ id: row.id, deckId: row.deckId, word: toWord(row) }))),
          Effect.orDie
        ),

      list: (learnerId, deckId, query: WordQuery) =>
        Effect.gen(function* () {
          // One extra row tells whether a next page exists.
          const rows = yield* listRows({
            learnerId,
            deckId,
            q: query.q,
            after: Option.getOrNull(decodeCursor(WordKeyset, query.cursor)),
            limit: query.limit + 1
          })
          const page = rows.slice(0, query.limit)
          const last = page.at(-1)
          const hasMore = rows.length > query.limit
          const nextCursor = hasMore && last !== undefined ? encodeCursor({ createdAt: DateTime.toEpochMillis(last.createdAt), slug: last.slug }) : null

          return { items: page.map(toWordWithCards), nextCursor } satisfies WordPage
        }).pipe(Effect.orDie),

      insert: (deckId, word: NewWord) =>
        insertRow({ ...word, deckId }).pipe(
          Effect.map(Option.map(toWord)),
          Effect.orDie
        ),

      update: (wordId, changes) =>
        updateRow({ wordId, columns: wordColumns(changes) }).pipe(
          Effect.map(Option.map(toWord)),
          // A unique violation means another live word in the deck already has these keys.
          Effect.catchTag("SqlError", (error) =>
            error.reason._tag === "UniqueViolation"
              ? Effect.succeed(Option.none<Word>())
              : Effect.fail(error)
          ),
          Effect.orDie
        ),

      softDelete: (wordId, at) =>
        Effect.gen(function* () {
          // An active session would keep asking for a word that no longer exists, so it ends here.
          yield* sql`
            UPDATE study_sessions SET status = 'abandoned', ended_at = ${new Date(at)}
            WHERE status = 'active'
              AND id IN (
                SELECT session_id FROM session_questions
                WHERE word_id = ${wordId} AND answered_at IS NULL
              )`
          yield* sql`UPDATE cards SET deleted_at = ${new Date(at)} WHERE word_id = ${wordId} AND deleted_at IS NULL`
          yield* sql`UPDATE words SET deleted_at = ${new Date(at)} WHERE id = ${wordId} AND deleted_at IS NULL`
        }).pipe(Effect.orDie),

      softDeleteInDeck: (deckId, at) =>
        Effect.gen(function* () {
          // Both the sessions scoped to this deck and the hard-words sessions still asking for one of its words.
          yield* sql`
            UPDATE study_sessions SET status = 'abandoned', ended_at = ${new Date(at)}
            WHERE status = 'active'
              AND (
                scope_deck_id = ${deckId}
                OR id IN (
                  SELECT q.session_id FROM session_questions q
                  JOIN words w ON w.id = q.word_id
                  WHERE w.deck_id = ${deckId} AND q.answered_at IS NULL
                )
              )`
          yield* sql`
            UPDATE cards SET deleted_at = ${new Date(at)}
            WHERE deleted_at IS NULL
              AND word_id IN (SELECT id FROM words WHERE deck_id = ${deckId} AND deleted_at IS NULL)`
          yield* sql`UPDATE words SET deleted_at = ${new Date(at)} WHERE deck_id = ${deckId} AND deleted_at IS NULL`
        }).pipe(Effect.orDie),

      preview: (deckId, limit) =>
        previewRows({ deckId, limit }).pipe(
          Effect.map((rows) => rows.map(toWord)),
          Effect.orDie
        ),

      liveWords: (deckId) =>
        liveWordRows(deckId).pipe(
          Effect.map((rows) => rows.map(toWord)),
          Effect.orDie
        ),

      listLive: (deckId) =>
        liveRows(deckId).pipe(
          Effect.map((rows): ReadonlyArray<WordCopy> => rows),
          Effect.orDie
        ),

      insertMany: (deckId, words) => {
        const rows = words.map((word): Record<string, unknown> => ({
          slug: word.slug,
          deck_id: deckId,
          term: word.term,
          reading: word.reading,
          meaning: word.meaning,
          example: word.example,
          notes: word.notes,
          term_key: word.termKey,
          reading_key: word.readingKey,
          meaning_key: word.meaningKey,
          created_at: new Date(word.createdAt)
        }))

        // A `sql.insert` needs at least one row; a deck with no live words copies nothing.
        if (!Arr.isReadonlyArrayNonEmpty(rows)) {
          return Effect.void
        }

        return sql`INSERT INTO words ${sql.insert(rows)}`.pipe(Effect.asVoid, Effect.orDie)
      },

      findTakenKeys: (deckId, keys) =>
        takenKeyRows({
          deckId,
          termKeys: keys.map((key) => key.termKey),
          readingKeys: keys.map((key) => key.readingKey)
        }).pipe(Effect.orDie),

      insertNew: (deckId, words) => {
        if (words.length === 0) {
          return Effect.succeed(0)
        }

        // One array per column, unnested into rows: a `VALUES` list would bind a parameter per cell, past Postgres's
        // limit for a 20,000-row import. An array of only nulls has no type the driver can infer, so an absent optional
        // text goes in as '' and `NULLIF` turns it back into NULL; stored optional text is never ''.
        const slugs = words.map((word) => word.slug)
        const terms = words.map((word) => word.term)
        const readings = words.map((word) => word.reading ?? "")
        const meanings = words.map((word) => word.meaning)
        const examples = words.map((word) => word.example ?? "")
        const notes = words.map((word) => word.notes ?? "")
        const termKeys = words.map((word) => word.termKey)
        const readingKeys = words.map((word) => word.readingKey)
        const meaningKeys = words.map((word) => word.meaningKey)
        const createdAts = words.map((word) => new Date(word.createdAt).toISOString())

        return sql<{ readonly slug: string }>`
          INSERT INTO words (slug, deck_id, term, reading, meaning, example, notes, term_key, reading_key, meaning_key,
                             created_at)
          SELECT t.slug, ${deckId}::bigint, t.term, NULLIF(t.reading, ''), t.meaning, NULLIF(t.example, ''),
                 NULLIF(t.notes, ''), t.term_key, t.reading_key, t.meaning_key, t.created_at
          FROM unnest(
            ${slugs}::text[], ${terms}::text[], ${readings}::text[], ${meanings}::text[], ${examples}::text[],
            ${notes}::text[], ${termKeys}::text[], ${readingKeys}::text[], ${meaningKeys}::text[],
            ${createdAts}::timestamptz[]
          ) AS t(slug, term, reading, meaning, example, notes, term_key, reading_key, meaning_key, created_at)
          ON CONFLICT (deck_id, term_key, reading_key) WHERE deleted_at IS NULL DO NOTHING
          RETURNING slug`.pipe(
          Effect.map((rows) => rows.length),
          Effect.orDie
        )
      }
    })
  })
)
