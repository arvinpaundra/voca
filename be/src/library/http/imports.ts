import { Effect } from "effect"
import type { Multipart } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { IMPORT_MAX_BYTES, ImportRunning, NotFound, PayloadTooLarge, Unauthorized, VocaApi } from "@voca/contract"
import {
  dismissImport,
  issueImportTicket,
  listImports,
  startImport,
  streamImportEvents
} from "../application/imports.ts"
import type { NewImportFile } from "../application/importsPorts.ts"
import { ImportBatches, ImportNotifier, ImportQueue, ImportTickets } from "../application/importsPorts.ts"
import type { Transaction } from "../../shared/transaction.ts"

/** One uploaded file, read into memory: the size is checked first, so a too-big file is never read. */
const readUpload = (file: Multipart.PersistedFile): Effect.Effect<NewImportFile, PayloadTooLarge> => {
  return Effect.gen(function* () {
    const upload = Bun.file(file.path)

    if (upload.size > IMPORT_MAX_BYTES) {
      return yield* Effect.fail(new PayloadTooLarge({ message: "A CSV file can be at most 5 MB" }))
    }

    const content = yield* Effect.tryPromise({
      try: () => upload.bytes(),
      catch: (cause) => cause
    }).pipe(Effect.orDie)

    return { name: file.name, content }
  })
}

/** The files' sizes on disk together, checked before any is read into memory. */
const checkTotalSize = (_files: ReadonlyArray<Multipart.PersistedFile>): Effect.Effect<void, PayloadTooLarge> =>
  Effect.die("not implemented: IB")

export const ImportsHandlers = HttpApiBuilder.group(
  VocaApi,
  "imports",
  Effect.fn(function* (handlers) {
    const ports = yield* Effect.context<ImportBatches | ImportQueue | ImportTickets | Transaction>()

    return handlers.handleAll({
      importDecks: ({ payload }) =>
        Effect.gen(function* () {
          yield* checkTotalSize(payload.files)

          const files = yield* Effect.forEach(payload.files, (file) => readUpload(file))

          return yield* startImport({ termLang: payload.termLang, meaningLang: payload.meaningLang, files })
        }).pipe(Effect.provideContext(ports)),

      listImports: () => listImports.pipe(Effect.provideContext(ports)),

      dismissImport: ({ params }) =>
        dismissImport(params.batchSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("ImportBatchNotFound", () => Effect.fail(new NotFound({ message: "Import not found" }))),
          Effect.catchTag("ImportBatchRunning", () =>
            Effect.fail(new ImportRunning({ message: "A file of this batch is still being imported" })))
        ),

      importEventsTicket: () => issueImportTicket.pipe(Effect.provideContext(ports))
    })
  })
)

export const ImportEventsHandlers = HttpApiBuilder.group(
  VocaApi,
  "importEvents",
  Effect.fn(function* (handlers) {
    const ports = yield* Effect.context<ImportNotifier | ImportTickets>()

    return handlers.handleAll({
      importEvents: ({ query }) =>
        streamImportEvents(query.ticket).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("ImportTicketInvalid", () =>
            Effect.fail(new Unauthorized({ message: "The ticket is unknown, used or expired" })))
        )
    })
  })
)
