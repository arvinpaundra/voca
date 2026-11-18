import { DateTime, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { Count, DeckDescription, DeckSlug, DeckTitle, LangTag, Visibility } from "@voca/contract"
import type { Deck, PublicDeck, UpdateDeck } from "@voca/contract"
import { DeckRepo } from "../application/deckRepo.ts"
import type {
  DeckCounts,
  LiveDeck,
  NewDeck,
  OwnedDeck,
  PublicDeckFound,
  PublicDeckPage,
  PublicDeckQuery
} from "../application/deckRepo.ts"

/** The source deck of a fork, `deleted` says whether it has since been deleted. Null for a deck that is not a fork. */
const ForkedFrom = Schema.NullOr(Schema.Struct({ slug: DeckSlug, title: DeckTitle, deleted: Schema.Boolean }))

/**
 * A `decks` row as selected below: `id::text`, columns aliased to camelCase. Every select reads `forkedFrom` from the
 * source deck, so the attribution stays when the source is deleted.
 */
const DeckRow = Schema.Struct({
  id: Schema.BigIntFromString,
  slug: DeckSlug,
  title: DeckTitle,
  description: DeckDescription,
  termLang: LangTag,
  meaningLang: LangTag,
  visibility: Visibility,
  publishedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  forkedFrom: ForkedFrom,
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
  createdAt: Schema.Number,
  forkedFromId: Schema.NullOr(Schema.BigInt)
})

const LiveDeckRow = Schema.Struct({
  id: Schema.BigIntFromString,
  visibility: Visibility,
  title: DeckTitle,
  description: DeckDescription,
  termLang: LangTag,
  meaningLang: LangTag
})

/** A public deck as the community lists it, with its owner's public name and avatar only. */
const PublicDeckRow = Schema.Struct({
  id: Schema.BigIntFromString,
  slug: DeckSlug,
  title: DeckTitle,
  description: DeckDescription,
  termLang: LangTag,
  meaningLang: LangTag,
  publishedAt: Schema.DateTimeUtcFromDate,
  forkCount: Count,
  wordCount: Count,
  ownerName: Schema.String,
  ownerAvatarUrl: Schema.NullOr(Schema.String)
})

/** A cursor is `<sort key>:<published_at millis>:<id>` of the last deck on the page: the keyset to continue after. */
const CursorParts = Schema.Tuple([Schema.NumberFromString, Schema.NumberFromString, Schema.BigIntFromString])

const decodeCursor = (cursor: string | null) => {
  return Option.map(Schema.decodeUnknownOption(CursorParts)((cursor ?? "").split(":")), ([sortKey, publishedAt, id]) => ({
    sortKey,
    publishedAt,
    id
  }))
}

const encodeCursor = (sortKey: number, publishedAt: number, id: bigint): string => {
  return `${sortKey}:${publishedAt}:${id}`
}

const toDeck = (row: typeof DeckRow.Type): Deck => {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    termLang: row.termLang,
    meaningLang: row.meaningLang,
    visibility: row.visibility,
    publishedAt: row.publishedAt,
    forkedFrom: row.forkedFrom,
    forkCount: row.forkCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

const toPublicDeck = (row: typeof PublicDeckRow.Type): PublicDeck => {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    termLang: row.termLang,
    meaningLang: row.meaningLang,
    publishedAt: row.publishedAt,
    forkCount: row.forkCount,
    wordCount: row.wordCount,
    owner: { name: row.ownerName, avatarUrl: row.ownerAvatarUrl }
  }
}

/** Columns that change are named in snake_case; `updated_at` is always set. Text is bound as ISO strings. */
const deckColumns = (patch: typeof UpdateDeck.Type, updatedAt: number): Record<string, string | null> => {
  const columns: Record<string, string | null> = {
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

/** Publishing sets `published_at` to the moment it happens; unpublishing clears it. */
const visibilityColumns = (
  visibility: "public" | "private",
  publishedAt: number | null,
  updatedAt: number
): Record<string, string | null> => {
  return {
    visibility,
    published_at: publishedAt === null ? null : new Date(publishedAt).toISOString(),
    updated_at: new Date(updatedAt).toISOString()
  }
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
               updated_at AS "updatedAt",
               (SELECT json_build_object('slug', p.slug, 'title', p.title, 'deleted', p.deleted_at IS NOT NULL)
                  FROM decks p WHERE p.id = decks.forked_from_id) AS "forkedFrom"
        FROM decks WHERE owner_id = ${learnerId} AND slug = ${slug} AND deleted_at IS NULL`
    })

    const listOwned = SqlSchema.findAll({
      Request: Schema.Struct({ learnerId: Schema.BigInt, now: Schema.Number }),
      Result: DeckSummaryRow,
      execute: ({ learnerId, now }) => sql`
        SELECT d.id::text AS id, d.slug, d.title, d.description, d.term_lang AS "termLang",
               d.meaning_lang AS "meaningLang", d.visibility, d.published_at AS "publishedAt",
               d.fork_count AS "forkCount", d.created_at AS "createdAt", d.updated_at AS "updatedAt",
               (SELECT json_build_object('slug', p.slug, 'title', p.title, 'deleted', p.deleted_at IS NOT NULL)
                  FROM decks p WHERE p.id = d.forked_from_id) AS "forkedFrom",
               (SELECT count(*)::int FROM words w WHERE w.deck_id = d.id AND w.deleted_at IS NULL) AS "wordCount",
               (SELECT count(*)::int FROM cards c JOIN words w ON w.id = c.word_id
                 WHERE w.deck_id = d.id AND w.deleted_at IS NULL AND c.learner_id = d.owner_id
                   AND c.deleted_at IS NULL AND c.due <= ${new Date(now)}) AS "dueCount"
        FROM decks d
        WHERE d.owner_id = ${learnerId} AND d.deleted_at IS NULL
        ORDER BY d.created_at DESC, d.id DESC`
    })

    // The same count expressions as `listOwned`, for one deck.
    const countsOf = SqlSchema.findOne({
      Request: Schema.Struct({ deckId: Schema.BigInt, learnerId: Schema.BigInt, now: Schema.Number }),
      Result: Schema.Struct({ wordCount: Count, dueCount: Count }),
      execute: ({ deckId, learnerId, now }) => sql`
        SELECT (SELECT count(*)::int FROM words w WHERE w.deck_id = ${deckId} AND w.deleted_at IS NULL) AS "wordCount",
               (SELECT count(*)::int FROM cards c JOIN words w ON w.id = c.word_id
                 WHERE w.deck_id = ${deckId} AND w.deleted_at IS NULL AND c.learner_id = ${learnerId}
                   AND c.deleted_at IS NULL AND c.due <= ${new Date(now)}) AS "dueCount"`
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
          forked_from_id: deck.forkedFromId,
          fork_count: 0,
          created_at: new Date(deck.createdAt),
          updated_at: new Date(deck.createdAt)
        })}
        RETURNING id::text AS id, slug, title, description, term_lang AS "termLang", meaning_lang AS "meaningLang",
          visibility, published_at AS "publishedAt", fork_count AS "forkCount", created_at AS "createdAt",
          updated_at AS "updatedAt",
          (SELECT json_build_object('slug', p.slug, 'title', p.title, 'deleted', p.deleted_at IS NOT NULL)
             FROM decks p WHERE p.id = decks.forked_from_id) AS "forkedFrom"`
    })

    const updateRow = SqlSchema.findOne({
      Request: Schema.Struct({ deckId: Schema.BigInt, columns: Schema.Record(Schema.String, Schema.NullOr(Schema.String)) }),
      Result: DeckRow,
      execute: ({ deckId, columns }) => sql`
        UPDATE decks SET ${sql.update(columns)}
        WHERE id = ${deckId}
        RETURNING id::text AS id, slug, title, description, term_lang AS "termLang", meaning_lang AS "meaningLang",
          visibility, published_at AS "publishedAt", fork_count AS "forkCount", created_at AS "createdAt",
          updated_at AS "updatedAt",
          (SELECT json_build_object('slug', p.slug, 'title', p.title, 'deleted', p.deleted_at IS NOT NULL)
             FROM decks p WHERE p.id = decks.forked_from_id) AS "forkedFrom"`
    })

    const hasWordsRow = SqlSchema.findOne({
      Request: Schema.BigInt,
      Result: Schema.Struct({ exists: Schema.Boolean }),
      execute: (deckId) => sql`
        SELECT EXISTS (SELECT 1 FROM words WHERE deck_id = ${deckId} AND deleted_at IS NULL) AS exists`
    })

    // The sort key is the fork count for "forks" and 0 for "new", so one row comparison serves both sorts.
    // `after` is the keyset: the comparison makes the page continue strictly after the cursor's deck.
    const listPublicRows = SqlSchema.findAll({
      Request: Schema.Struct({
        q: Schema.NullOr(Schema.String),
        termLang: Schema.NullOr(Schema.String),
        forks: Schema.Boolean,
        after: Schema.NullOr(Schema.Struct({ sortKey: Schema.Number, publishedAt: Schema.Number, id: Schema.BigInt })),
        limit: Schema.Number
      }),
      Result: PublicDeckRow,
      execute: ({ q, termLang, forks, after, limit }) => {
        const afterKey = after === null ? null : after.sortKey
        const afterAt = after === null ? null : new Date(after.publishedAt)
        const afterId = after === null ? null : after.id

        return sql`
          SELECT d.id::text AS id, d.slug, d.title, d.description, d.term_lang AS "termLang",
                 d.meaning_lang AS "meaningLang", d.published_at AS "publishedAt", d.fork_count AS "forkCount",
                 (SELECT count(*)::int FROM words w WHERE w.deck_id = d.id AND w.deleted_at IS NULL) AS "wordCount",
                 l.name AS "ownerName", l.avatar_url AS "ownerAvatarUrl"
          FROM decks d
          JOIN learners l ON l.id = d.owner_id
          WHERE d.visibility = 'public' AND d.deleted_at IS NULL
            AND (${q}::text IS NULL OR strpos(lower(d.title), ${q}::text) > 0)
            AND (${termLang}::text IS NULL OR d.term_lang = ${termLang}::text)
            AND (${afterId}::bigint IS NULL
                 OR (CASE WHEN ${forks}::boolean THEN d.fork_count ELSE 0 END, d.published_at, d.id)
                    < (${afterKey}::int, ${afterAt}::timestamptz, ${afterId}::bigint))
          ORDER BY CASE WHEN ${forks}::boolean THEN d.fork_count ELSE 0 END DESC, d.published_at DESC, d.id DESC
          LIMIT ${limit}`
      }
    })

    const findPublicRow = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: PublicDeckRow,
      execute: (deckSlug) => sql`
        SELECT d.id::text AS id, d.slug, d.title, d.description, d.term_lang AS "termLang",
               d.meaning_lang AS "meaningLang", d.published_at AS "publishedAt", d.fork_count AS "forkCount",
               (SELECT count(*)::int FROM words w WHERE w.deck_id = d.id AND w.deleted_at IS NULL) AS "wordCount",
               l.name AS "ownerName", l.avatar_url AS "ownerAvatarUrl"
        FROM decks d
        JOIN learners l ON l.id = d.owner_id
        WHERE d.slug = ${deckSlug} AND d.visibility = 'public' AND d.deleted_at IS NULL`
    })

    const findLiveRow = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: LiveDeckRow,
      execute: (deckSlug) => sql`
        SELECT id::text AS id, visibility, title, description, term_lang AS "termLang",
               meaning_lang AS "meaningLang"
        FROM decks WHERE slug = ${deckSlug} AND deleted_at IS NULL`
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

      counts: (deckId, learnerId, now) =>
        countsOf({ deckId, learnerId, now }).pipe(
          Effect.map((row): DeckCounts => ({ wordCount: row.wordCount, dueCount: row.dueCount })),
          Effect.orDie
        ),

      insert: (learnerId, deck: NewDeck) =>
        insert({ learnerId, ...deck }).pipe(
          Effect.map((row): OwnedDeck => ({ id: row.id, deck: toDeck(row) })),
          Effect.orDie
        ),

      update: (deckId, patch, updatedAt) =>
        updateRow({ deckId, columns: deckColumns(patch, updatedAt) }).pipe(Effect.map(toDeck), Effect.orDie),

      publish: (deckId, at) =>
        updateRow({ deckId, columns: visibilityColumns("public", at, at) }).pipe(Effect.map(toDeck), Effect.orDie),

      unpublish: (deckId, at) =>
        updateRow({ deckId, columns: visibilityColumns("private", null, at) }).pipe(
          Effect.map(toDeck),
          Effect.orDie
        ),

      incrementForkCount: (deckId) =>
        sql`UPDATE decks SET fork_count = fork_count + 1 WHERE id = ${deckId}`.pipe(Effect.asVoid, Effect.orDie),

      hasWords: (deckId) =>
        hasWordsRow(deckId).pipe(Effect.map((row) => row.exists), Effect.orDie),

      softDelete: (deckId, at) =>
        // Unpublished as well, so an admin undoing the delete doesn't silently republish it.
        sql`
          UPDATE decks
          SET deleted_at = ${new Date(at)}, visibility = 'private', published_at = NULL
          WHERE id = ${deckId} AND deleted_at IS NULL`.pipe(
          Effect.asVoid,
          Effect.orDie
        ),

      listPublic: (query: PublicDeckQuery): Effect.Effect<PublicDeckPage> =>
        Effect.gen(function* () {
          const forks = query.sort === "forks"
          // One extra row tells whether a next page exists.
          const rows = yield* listPublicRows({
            q: query.q,
            termLang: query.termLang,
            forks,
            after: Option.getOrNull(decodeCursor(query.cursor)),
            limit: query.limit + 1
          })
          const page = rows.slice(0, query.limit)
          const last = page.at(-1)
          const hasMore = rows.length > query.limit
          const nextCursor =
            hasMore && last !== undefined
              ? encodeCursor(forks ? last.forkCount : 0, DateTime.toEpochMillis(last.publishedAt), last.id)
              : null

          return { items: page.map(toPublicDeck), nextCursor } satisfies PublicDeckPage
        }).pipe(Effect.orDie),

      findPublic: (deckSlug) =>
        findPublicRow(deckSlug).pipe(
          Effect.map(Option.map((row): PublicDeckFound => ({ id: row.id, deck: toPublicDeck(row) }))),
          Effect.orDie
        ),

      findLive: (deckSlug) =>
        findLiveRow(deckSlug).pipe(
          Effect.map(Option.map((row): LiveDeck => ({
            id: row.id,
            visibility: row.visibility,
            title: row.title,
            description: row.description,
            termLang: row.termLang,
            meaningLang: row.meaningLang
          }))),
          Effect.orDie
        )
    })
  })
)
