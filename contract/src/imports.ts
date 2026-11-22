import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { Multipart } from "effect/http"
import { ImportRowError, ImportRunning, NotFound, PayloadTooLarge, Unauthorized } from "./errors.ts"
import { IMPORT_MAX_BYTES } from "./library.ts"
import { Count, DeckTitle, Instant, LangTag } from "./primitives.ts"
import { DeckSlug, ImportBatchSlug } from "./slug.ts"

export const IMPORT_MAX_FILES = 50

/** All the files of one batch together; checked on disk sizes before any file is read into memory. */
export const IMPORT_MAX_TOTAL_BYTES = 50 * 1024 * 1024

/**
 * Every file becomes a new deck in these languages. More than `IMPORT_MAX_FILES` files fail the Schema (400), so
 * nothing is stored; more than `IMPORT_MAX_TOTAL_BYTES` bytes in all is refused by the handler (413).
 * `maxParts` leaves room for the count check instead of cutting the upload short.
 */
export const ImportDecks = Schema.Struct({
  termLang: LangTag,
  meaningLang: LangTag,
  files: Multipart.FilesSchema.check(Schema.isMinLength(1), Schema.isMaxLength(IMPORT_MAX_FILES))
}).pipe(
  HttpApiSchema.asMultipart({ maxFileSize: IMPORT_MAX_BYTES, maxParts: IMPORT_MAX_FILES + 10 })
)

export const ImportFileStatus = Schema.Literals(["pending", "running", "done", "failed"])
export type ImportFileStatus = typeof ImportFileStatus.Type

/** One file of a batch. `done`: `deck` is set; `failed`: `deck` is null and `errors` holds the first 100 problems. */
export const ImportFile = Schema.Struct({
  name: Schema.String,
  status: ImportFileStatus,
  deck: Schema.NullOr(Schema.Struct({ slug: DeckSlug, title: DeckTitle })),
  imported: Count,
  skippedDuplicates: Count,
  errors: Schema.Array(ImportRowError),
  totalErrors: Count
})
export type ImportFile = typeof ImportFile.Type

/** `files` in upload order; the worker imports them in that order. */
export const ImportBatch = Schema.Struct({
  slug: ImportBatchSlug,
  termLang: LangTag,
  meaningLang: LangTag,
  createdAt: Instant,
  files: Schema.Array(ImportFile)
})
export type ImportBatch = typeof ImportBatch.Type

/** A nudge, not the data: the client refetches `GET /imports` on every event. */
export const ImportEvent = Schema.Struct({
  batch: ImportBatchSlug,
  status: Schema.Literals(["running", "finished"])
})
export type ImportEvent = typeof ImportEvent.Type

/**
 * Sent on connect and every 20 s while the stream is open, so a proxy never sees it idle (Cloudflare answers 524
 * after 100 s without a byte). The client ignores it.
 */
export const ImportPing = Schema.Struct({ status: Schema.Literal("ping") })
export type ImportPing = typeof ImportPing.Type

export const ImportStreamEvent = Schema.Union([ImportEvent, ImportPing])
export type ImportStreamEvent = typeof ImportStreamEvent.Type

/** Single use, short-lived: lets the browser's `EventSource`, which can't send a bearer header, open the stream. */
export const StreamTicket = Schema.Struct({ ticket: Schema.String })
export type StreamTicket = typeof StreamTicket.Type

const batchParams = { batchSlug: ImportBatchSlug }

export class ImportsGroup extends HttpApiGroup.make("imports").add(
  HttpApiEndpoint.post("importDecks", "/imports", {
    payload: ImportDecks,
    success: ImportBatch,
    error: PayloadTooLarge
  }),
  /** The Learner's batches not yet dismissed, newest first. */
  HttpApiEndpoint.get("listImports", "/imports", { success: Schema.Array(ImportBatch) }),
  HttpApiEndpoint.delete("dismissImport", "/imports/:batchSlug", {
    params: batchParams,
    error: [NotFound, ImportRunning]
  }),
  HttpApiEndpoint.post("importEventsTicket", "/imports/events/ticket", { success: StreamTicket })
) {}

/** Public: the ticket in the query is the credential. Events only for the ticket's Learner. */
export class ImportEventsGroup extends HttpApiGroup.make("importEvents").add(
  HttpApiEndpoint.get("importEvents", "/imports/events", {
    query: { ticket: Schema.String },
    success: HttpApiSchema.StreamSse({ data: ImportStreamEvent }),
    error: Unauthorized
  })
) {}
