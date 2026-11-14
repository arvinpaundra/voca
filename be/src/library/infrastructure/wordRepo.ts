import { DateTime, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Example, Meaning, Notes, Reading, Term, WordCard, WordSlug } from "@voca/contract"
import type { Word, WordWithCards } from "@voca/contract"
import { WordRepo } from "../application/wordRepo.ts"
import type { NewWord, OwnedWord, WordChanges, WordPage, WordQuery } from "../application/wordRepo.ts"

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

/** A cursor is `<created_at millis>:<id>` of the last word on the page: the keyset to continue after. */
const CursorParts = Schema.Tuple([Schema.NumberFromString, Schema.BigIntFromString])

const decodeCursor = (cursor: string | null) => {
  return Option.map(Schema.decodeUnknownOption(CursorParts)((cursor ?? "").split(":")), ([createdAt, id]) => ({
    createdAt,
    id
  }))
}

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
        after: Schema.NullOr(Schema.Struct({ createdAt: Schema.Number, id: Schema.BigInt })),
        limit: Schema.Number
      }),
      Result: WordWithCardsRow,
      execute: ({ learnerId, deckId, q, after, limit }) => {
        const afterAt = after === null ? null : new Date(after.createdAt)
        const afterId = after === null ? null : after.id

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
                 OR (w.created_at, w.id) > (${afterAt}::timestamptz, ${afterId}::bigint))
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
            after: Option.getOrNull(decodeCursor(query.cursor)),
            limit: query.limit + 1
          })
          const page = rows.slice(0, query.limit)
          const last = page.at(-1)
          const hasMore = rows.length > query.limit
          const nextCursor = hasMore && last !== undefined ? `${DateTime.toEpochMillis(last.createdAt)}:${last.id}` : null

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
          yield* sql`UPDATE cards SET deleted_at = ${new Date(at)} WHERE word_id = ${wordId} AND deleted_at IS NULL`
          yield* sql`UPDATE words SET deleted_at = ${new Date(at)} WHERE id = ${wordId} AND deleted_at IS NULL`
        }).pipe(Effect.orDie),

      softDeleteInDeck: (deckId, at) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE cards SET deleted_at = ${new Date(at)}
            WHERE deleted_at IS NULL
              AND word_id IN (SELECT id FROM words WHERE deck_id = ${deckId} AND deleted_at IS NULL)`
          yield* sql`UPDATE words SET deleted_at = ${new Date(at)} WHERE deck_id = ${deckId} AND deleted_at IS NULL`
        }).pipe(Effect.orDie)
    })
  })
)
