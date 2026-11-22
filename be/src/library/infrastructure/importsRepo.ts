import { Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import {
  Count,
  DeckSlug,
  DeckTitle,
  ImportBatchSlug,
  ImportFileStatus,
  ImportRowError,
  LangTag
} from "@voca/contract"
import type { ImportBatch, ImportFile } from "@voca/contract"
import { ImportBatches } from "../application/importsPorts.ts"
import type { ActiveBatch, ImportedFile, NewImportBatch, StoredFile } from "../application/importsPorts.ts"
import type { CsvRowError } from "../domain/errors.ts"

const BatchRow = Schema.Struct({
  id: Schema.BigIntFromString,
  slug: ImportBatchSlug,
  termLang: LangTag,
  meaningLang: LangTag,
  createdAt: Schema.DateTimeUtcFromDate
})

/** A file of the Learner's batches, with its deck when it has one. `batchId` groups the files of one batch. */
const FileRow = Schema.Struct({
  batchId: Schema.BigIntFromString,
  name: Schema.String,
  status: ImportFileStatus,
  deckSlug: Schema.NullOr(DeckSlug),
  deckTitle: Schema.NullOr(DeckTitle),
  imported: Count,
  skippedDuplicates: Count,
  errors: Schema.Array(ImportRowError),
  totalErrors: Count
})

const StoredFileRow = Schema.Struct({
  id: Schema.BigIntFromString,
  batchId: Schema.BigIntFromString,
  batchSlug: ImportBatchSlug,
  learnerId: Schema.BigIntFromString,
  termLang: LangTag,
  meaningLang: LangTag,
  name: Schema.String,
  status: ImportFileStatus,
  content: Schema.NullOr(Schema.Uint8Array)
})

const IdRow = Schema.Struct({ id: Schema.BigIntFromString })

const toImportFile = (row: typeof FileRow.Type): ImportFile => {
  const deck = row.deckSlug === null || row.deckTitle === null ? null : { slug: row.deckSlug, title: row.deckTitle }

  return {
    name: row.name,
    status: row.status,
    deck,
    imported: row.imported,
    skippedDuplicates: row.skippedDuplicates,
    errors: row.errors,
    totalErrors: row.totalErrors
  }
}

/**
 * The batch store. Every statement is a `sql` template; file contents are bound as bytes. A file's bytes are cleared
 * when it finishes, so the table only holds what the worker still has to read.
 */
export const ImportBatchesLive = Layer.effect(
  ImportBatches,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const insertBatch = SqlSchema.findOne({
      Request: Schema.Struct({
        slug: ImportBatchSlug,
        learnerId: Schema.BigInt,
        termLang: Schema.String,
        meaningLang: Schema.String,
        createdAt: Schema.Number
      }),
      Result: IdRow,
      execute: (batch) => sql`
        INSERT INTO import_batches (slug, learner_id, term_lang, meaning_lang, created_at, dismissed_at)
        VALUES (${batch.slug}, ${batch.learnerId}, ${batch.termLang}, ${batch.meaningLang},
                ${new Date(batch.createdAt)}, NULL)
        RETURNING id::text AS id`
    })

    const insertFile = SqlSchema.findOne({
      Request: Schema.Struct({
        batchId: Schema.BigInt,
        position: Schema.Number,
        name: Schema.String,
        content: Schema.Uint8Array
      }),
      Result: IdRow,
      execute: (file) => sql`
        INSERT INTO import_files (batch_id, position, name, content, status, deck_id, imported, skipped_duplicates,
                                  errors, total_errors)
        VALUES (${file.batchId}, ${file.position}, ${file.name}, ${file.content}, 'pending', NULL, 0, 0,
                '[]'::jsonb, 0)
        RETURNING id::text AS id`
    })

    const listBatches = SqlSchema.findAll({
      Request: Schema.BigInt,
      Result: BatchRow,
      execute: (learnerId) => sql`
        SELECT id::text AS id, slug, term_lang AS "termLang", meaning_lang AS "meaningLang", created_at AS "createdAt"
        FROM import_batches
        WHERE learner_id = ${learnerId} AND dismissed_at IS NULL
        ORDER BY created_at DESC, id DESC`
    })

    const listFiles = SqlSchema.findAll({
      Request: Schema.BigInt,
      Result: FileRow,
      execute: (learnerId) => sql`
        SELECT f.batch_id::text AS "batchId", f.name, f.status, d.slug AS "deckSlug", d.title AS "deckTitle",
               f.imported, f.skipped_duplicates AS "skippedDuplicates", f.errors, f.total_errors AS "totalErrors"
        FROM import_files f
        JOIN import_batches b ON b.id = f.batch_id
        LEFT JOIN decks d ON d.id = f.deck_id
        WHERE b.learner_id = ${learnerId} AND b.dismissed_at IS NULL
        ORDER BY f.batch_id, f.position`
    })

    const findActiveRow = SqlSchema.findOneOption({
      Request: Schema.Struct({ learnerId: Schema.BigInt, slug: Schema.String }),
      Result: Schema.Struct({ id: Schema.BigIntFromString, unfinished: Count }),
      execute: ({ learnerId, slug }) => sql`
        SELECT b.id::text AS id,
               (SELECT count(*)::int FROM import_files f
                 WHERE f.batch_id = b.id AND f.status IN ('pending', 'running')) AS unfinished
        FROM import_batches b
        WHERE b.learner_id = ${learnerId} AND b.slug = ${slug} AND b.dismissed_at IS NULL`
    })

    const findFileRow = SqlSchema.findOneOption({
      Request: Schema.BigInt,
      Result: StoredFileRow,
      execute: (fileId) => sql`
        SELECT f.id::text AS id, f.batch_id::text AS "batchId", b.slug AS "batchSlug",
               b.learner_id::text AS "learnerId", b.term_lang AS "termLang", b.meaning_lang AS "meaningLang",
               f.name, f.status, f.content
        FROM import_files f
        JOIN import_batches b ON b.id = f.batch_id
        WHERE f.id = ${fileId}`
    })

    const unfinishedRow = SqlSchema.findOne({
      Request: Schema.BigInt,
      Result: Schema.Struct({ count: Count }),
      execute: (batchId) => sql`
        SELECT count(*)::int AS count FROM import_files
        WHERE batch_id = ${batchId} AND status IN ('pending', 'running')`
    })

    const insert = (batch: NewImportBatch) =>
      Effect.gen(function* () {
        const created = yield* insertBatch({
          slug: batch.slug,
          learnerId: batch.learnerId,
          termLang: batch.termLang,
          meaningLang: batch.meaningLang,
          createdAt: batch.createdAt
        })
        const batchId = created.id
        const ids = yield* Effect.forEach(
          batch.files.map((file, position) => ({ file, position })),
          ({ file, position }) =>
            insertFile({ batchId, position, name: file.name, content: file.content }).pipe(
              Effect.map((row) => row.id)
            )
        )

        return ids
      }).pipe(Effect.orDie)

    const list = (learnerId: bigint) =>
      Effect.gen(function* () {
        const batches = yield* listBatches(learnerId)
        const files = yield* listFiles(learnerId)
        const filesOf = new Map<bigint, Array<ImportFile>>()

        for (const row of files) {
          const bucket = filesOf.get(row.batchId) ?? []

          bucket.push(toImportFile(row))
          filesOf.set(row.batchId, bucket)
        }

        return batches.map(
          (batch): ImportBatch => ({
            slug: batch.slug,
            termLang: batch.termLang,
            meaningLang: batch.meaningLang,
            createdAt: batch.createdAt,
            files: filesOf.get(batch.id) ?? []
          })
        )
      }).pipe(Effect.orDie)

    const findActive = (learnerId: bigint, batchSlug: string) =>
      findActiveRow({ learnerId, slug: batchSlug }).pipe(
        Effect.map(Option.map((row): ActiveBatch => ({ id: row.id, unfinished: row.unfinished }))),
        Effect.orDie
      )

    const dismiss = (batchId: bigint, at: number) =>
      sql`UPDATE import_batches SET dismissed_at = ${new Date(at)} WHERE id = ${batchId}`.pipe(
        Effect.asVoid,
        Effect.orDie
      )

    const findFile = (fileId: bigint) =>
      findFileRow(fileId).pipe(
        Effect.map(Option.map((row): StoredFile => row)),
        Effect.orDie
      )

    const markRunning = (fileId: bigint) =>
      sql`UPDATE import_files SET status = 'running' WHERE id = ${fileId}`.pipe(Effect.asVoid, Effect.orDie)

    const markDone = (fileId: bigint, imported: ImportedFile) =>
      sql`
        UPDATE import_files
        SET status = 'done', deck_id = ${imported.deckId}, imported = ${imported.imported},
            skipped_duplicates = ${imported.skippedDuplicates}, content = NULL
        WHERE id = ${fileId}`.pipe(Effect.asVoid, Effect.orDie)

    const markFailed = (fileId: bigint, errors: ReadonlyArray<CsvRowError>, totalErrors: number) =>
      sql`
        UPDATE import_files
        SET status = 'failed', errors = ${JSON.stringify(errors)}::jsonb, total_errors = ${totalErrors}, content = NULL
        WHERE id = ${fileId}`.pipe(Effect.asVoid, Effect.orDie)

    const unfinishedCount = (batchId: bigint) =>
      unfinishedRow(batchId).pipe(
        Effect.map((row) => row.count),
        Effect.orDie
      )

    return ImportBatches.of({
      insert,
      list,
      findActive,
      dismiss,
      findFile,
      markRunning,
      markDone,
      markFailed,
      unfinishedCount
    })
  })
)
