import { Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Count, DeckDescription, DeckSlug, DeckTitle, LangTag, Visibility } from "@voca/contract"
import type { Deck, UpdateDeck } from "@voca/contract"
import { DeckRepo } from "../application/deckRepo.ts"
import type { NewDeck, OwnedDeck } from "../application/deckRepo.ts"

/** A `decks` row as selected below: `id::text`, columns aliased to camelCase. */
const DeckRow = Schema.Struct({
  id: Schema.BigIntFromString,
  slug: DeckSlug,
  title: DeckTitle,
  description: DeckDescription,
  termLang: LangTag,
  meaningLang: LangTag,
  visibility: Visibility,
  publishedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  forkCount: Count,
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate
})

const DeckSummaryRow = Schema.Struct({
  ...DeckRow.fields,
  wordCount: Count,
  dueCount: Count
})

const NewDeckRequest = Schema.Struct({
  learnerId: Schema.BigInt,
  slug: Schema.String,
  title: Schema.String,
  description: Schema.String,
  termLang: Schema.String,
  meaningLang: Schema.String,
  createdAt: Schema.Number
})

/** Forks come with publishing, a later feature, so no deck is a fork yet. */
const toDeck = (row: typeof DeckRow.Type): Deck => {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    termLang: row.termLang,
    meaningLang: row.meaningLang,
    visibility: row.visibility,
    publishedAt: row.publishedAt,
    forkedFrom: null,
    forkCount: row.forkCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

/** Columns that change are named in snake_case; `updated_at` is always set. Text is bound as ISO strings. */
const deckColumns = (patch: typeof UpdateDeck.Type, updatedAt: number): Record<string, string> => {
  const columns: Record<string, string> = {
    updated_at: new Date(updatedAt).toISOString()
  }

  if (patch.title !== undefined) {
    columns.title = patch.title
  }

  if (patch.description !== undefined) {
    columns.description = patch.description
  }

  if (patch.termLang !== undefined) {
    columns.term_lang = patch.termLang
  }

  if (patch.meaningLang !== undefined) {
    columns.meaning_lang = patch.meaningLang
  }

  return columns
}

export const DeckRepoLive = Layer.effect(
  DeckRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findOwned = SqlSchema.findOneOption({
      Request: Schema.Struct({ learnerId: Schema.BigInt, slug: Schema.String }),
      Result: DeckRow,
      execute: ({ learnerId, slug }) => sql`
        SELECT id::text AS id, slug, title, description, term_lang AS "termLang", meaning_lang AS "meaningLang",
               visibility, published_at AS "publishedAt", fork_count AS "forkCount", created_at AS "createdAt",
               updated_at AS "updatedAt"
        FROM decks WHERE owner_id = ${learnerId} AND slug = ${slug} AND deleted_at IS NULL`
    })

    const listOwned = SqlSchema.findAll({
      Request: Schema.Struct({ learnerId: Schema.BigInt, now: Schema.Number }),
      Result: DeckSummaryRow,
      execute: ({ learnerId, now }) => sql`
        SELECT d.id::text AS id, d.slug, d.title, d.description, d.term_lang AS "termLang",
               d.meaning_lang AS "meaningLang", d.visibility, d.published_at AS "publishedAt",
               d.fork_count AS "forkCount", d.created_at AS "createdAt", d.updated_at AS "updatedAt",
               (SELECT count(*)::int FROM words w WHERE w.deck_id = d.id AND w.deleted_at IS NULL) AS "wordCount",
               (SELECT count(*)::int FROM cards c JOIN words w ON w.id = c.word_id
                 WHERE w.deck_id = d.id AND w.deleted_at IS NULL AND c.learner_id = d.owner_id
                   AND c.deleted_at IS NULL AND c.due <= ${new Date(now)}) AS "dueCount"
        FROM decks d
        WHERE d.owner_id = ${learnerId} AND d.deleted_at IS NULL
        ORDER BY d.created_at DESC, d.id DESC`
    })

    const insert = SqlSchema.findOne({
      Request: NewDeckRequest,
      Result: DeckRow,
      execute: (deck) => sql`
        INSERT INTO decks ${sql.insert({
          slug: deck.slug,
          owner_id: deck.learnerId,
          title: deck.title,
          description: deck.description,
          term_lang: deck.termLang,
          meaning_lang: deck.meaningLang,
          visibility: "private",
          published_at: null,
          forked_from_id: null,
          fork_count: 0,
          created_at: new Date(deck.createdAt),
          updated_at: new Date(deck.createdAt)
        })}
        RETURNING id::text AS id, slug, title, description, term_lang AS "termLang", meaning_lang AS "meaningLang",
          visibility, published_at AS "publishedAt", fork_count AS "forkCount", created_at AS "createdAt",
          updated_at AS "updatedAt"`
    })

    const updateRow = SqlSchema.findOne({
      Request: Schema.Struct({ deckId: Schema.BigInt, columns: Schema.Record(Schema.String, Schema.String) }),
      Result: DeckRow,
      execute: ({ deckId, columns }) => sql`
        UPDATE decks SET ${sql.update(columns)}
        WHERE id = ${deckId}
        RETURNING id::text AS id, slug, title, description, term_lang AS "termLang", meaning_lang AS "meaningLang",
          visibility, published_at AS "publishedAt", fork_count AS "forkCount", created_at AS "createdAt",
          updated_at AS "updatedAt"`
    })

    const hasWordsRow = SqlSchema.findOne({
      Request: Schema.BigInt,
      Result: Schema.Struct({ exists: Schema.Boolean }),
      execute: (deckId) => sql`
        SELECT EXISTS (SELECT 1 FROM words WHERE deck_id = ${deckId} AND deleted_at IS NULL) AS exists`
    })

    return DeckRepo.of({
      listOwned: (learnerId, now) =>
        listOwned({ learnerId, now }).pipe(
          Effect.map((rows) => rows.map((row) => ({ ...toDeck(row), wordCount: row.wordCount, dueCount: row.dueCount }))),
          Effect.orDie
        ),

      findOwned: (learnerId, slug) =>
        findOwned({ learnerId, slug }).pipe(
          Effect.map(Option.map((row): OwnedDeck => ({ id: row.id, deck: toDeck(row) }))),
          Effect.orDie
        ),

      insert: (learnerId, deck: NewDeck) =>
        insert({ learnerId, ...deck }).pipe(Effect.map(toDeck), Effect.orDie),

      update: (deckId, patch, updatedAt) =>
        updateRow({ deckId, columns: deckColumns(patch, updatedAt) }).pipe(Effect.map(toDeck), Effect.orDie),

      hasWords: (deckId) =>
        hasWordsRow(deckId).pipe(Effect.map((row) => row.exists), Effect.orDie),

      softDelete: (deckId, at) =>
        sql`UPDATE decks SET deleted_at = ${new Date(at)} WHERE id = ${deckId} AND deleted_at IS NULL`.pipe(
          Effect.asVoid,
          Effect.orDie
        )
    })
  })
)
