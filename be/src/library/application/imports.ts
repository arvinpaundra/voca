import { Clock, Data, Effect, Option, type Stream } from "effect"
import { CurrentLearner, SLUG_LENGTH } from "@voca/contract"
import type { ImportBatch, ImportBatchSlug, ImportEvent, StreamTicket } from "@voca/contract"
import { batchSlugOf, pendingBatch } from "../domain/imports.ts"
import { newSlug } from "../domain/slug.ts"
import { Transaction } from "../../shared/transaction.ts"
import { ImportBatches, ImportNotifier, ImportQueue, ImportTickets } from "./importsPorts.ts"
import type { NewImportFile } from "./importsPorts.ts"

export class ImportBatchNotFound extends Data.TaggedError("ImportBatchNotFound")<{}> {}

/** A file of the batch is still pending or running: a batch can't be dismissed until the worker is done with it. */
export class ImportBatchRunning extends Data.TaggedError("ImportBatchRunning")<{}> {}

/** Unknown, used or expired: the stream is refused. */
export class ImportTicketInvalid extends Data.TaggedError("ImportTicketInvalid")<{}> {}

export interface StartImportInput {
  readonly termLang: string
  readonly meaningLang: string
  readonly files: ReadonlyArray<NewImportFile>
}

/**
 * Stores the batch with every file's bytes in one transaction, then puts one job per file. The worker imports the
 * files in the background; the answer lists them all as pending.
 */
export const startImport = (input: StartImportInput) =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const batches = yield* ImportBatches
    const queue = yield* ImportQueue
    const transaction = yield* Transaction
    const slug = batchSlugOf(yield* newSlug(SLUG_LENGTH.importBatch))
    const createdAt = yield* Clock.currentTimeMillis
    const fileIds = yield* transaction.run(
      batches.insert({
        slug,
        learnerId: id,
        termLang: input.termLang,
        meaningLang: input.meaningLang,
        createdAt,
        files: input.files
      })
    )

    yield* Effect.forEach(fileIds, (fileId) => queue.put(fileId))

    return pendingBatch({
      slug,
      termLang: input.termLang,
      meaningLang: input.meaningLang,
      createdAt,
      names: input.files.map((file) => file.name)
    })
  })

/** The Learner's batches not dismissed, newest first. */
export const listImports = Effect.gen(function* () {
  const { id } = yield* CurrentLearner
  const batches = yield* ImportBatches

  return yield* batches.list(id)
})

/** Hides a finished batch from the Learner's list. Another Learner's batch is unknown to this one. */
export const dismissImport = (batchSlug: ImportBatchSlug) =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const batches = yield* ImportBatches
    const found = yield* batches.findActive(id, batchSlug)
    const active = yield* Option.match(found, {
      onNone: () => Effect.fail(new ImportBatchNotFound()),
      onSome: Effect.succeed
    })

    if (active.unfinished > 0) {
      return yield* Effect.fail(new ImportBatchRunning())
    }

    const at = yield* Clock.currentTimeMillis

    yield* batches.dismiss(active.id, at)
  })

/** A ticket for the Learner's event stream: the browser's `EventSource` can't send the bearer token. */
export const issueImportTicket = Effect.gen(function* () {
  const { id } = yield* CurrentLearner
  const tickets = yield* ImportTickets
  const ticket = yield* tickets.issue(id)

  return { ticket } satisfies StreamTicket
})

/** The events of the Learner the ticket was issued to. The ticket is spent: a second use is refused. */
export const streamImportEvents = (
  ticket: string
): Effect.Effect<Stream.Stream<ImportEvent>, ImportTicketInvalid, ImportTickets | ImportNotifier> =>
  Effect.gen(function* () {
    const tickets = yield* ImportTickets
    const notifier = yield* ImportNotifier
    const found = yield* tickets.redeem(ticket)
    const learnerId = yield* Option.match(found, {
      onNone: () => Effect.fail(new ImportTicketInvalid()),
      onSome: Effect.succeed
    })

    return notifier.events(learnerId)
  })
