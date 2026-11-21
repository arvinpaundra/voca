import type { Effect, Option, Stream } from "effect"
import { Context } from "effect"
import type { ImportBatch, ImportBatchSlug, ImportEvent, ImportFileStatus } from "@voca/contract"
import type { CsvRowError } from "../domain/errors.ts"

export interface NewImportFile {
  readonly name: string
  readonly content: Uint8Array
}

/** A batch to store: `files` in upload order, every one of them pending. */
export interface NewImportBatch {
  readonly slug: ImportBatchSlug
  readonly learnerId: bigint
  readonly termLang: string
  readonly meaningLang: string
  readonly createdAt: number
  readonly files: ReadonlyArray<NewImportFile>
}

/** A batch the Learner can still dismiss, and how many of its files are not finished yet. */
export interface ActiveBatch {
  readonly id: bigint
  readonly unfinished: number
}

/** A file for the worker. `content` is set until the file is finished. */
export interface StoredFile {
  readonly id: bigint
  readonly batchId: bigint
  readonly batchSlug: ImportBatchSlug
  readonly learnerId: bigint
  readonly termLang: string
  readonly meaningLang: string
  readonly name: string
  readonly status: ImportFileStatus
  readonly content: Uint8Array | null
}

/** The outcome of a file that imported: its deck and the counts the upload page shows. */
export interface ImportedFile {
  readonly deckId: bigint
  readonly imported: number
  readonly skippedDuplicates: number
}

/** Batches and their files, always scoped to the Learner that owns them. Infrastructure failures are defects. */
export class ImportBatches extends Context.Service<ImportBatches, {
  /** Stores the batch and its files; returns the file ids in upload order. */
  insert(batch: NewImportBatch): Effect.Effect<ReadonlyArray<bigint>>
  /** The Learner's batches not dismissed, newest first, each with its files in upload order. */
  list(learnerId: bigint): Effect.Effect<ReadonlyArray<ImportBatch>>
  /** The Learner's batch by slug, when it is not dismissed. */
  findActive(learnerId: bigint, batchSlug: string): Effect.Effect<Option.Option<ActiveBatch>>
  dismiss(batchId: bigint, at: number): Effect.Effect<void>
  findFile(fileId: bigint): Effect.Effect<Option.Option<StoredFile>>
  markRunning(fileId: bigint): Effect.Effect<void>
  markDone(fileId: bigint, imported: ImportedFile): Effect.Effect<void>
  markFailed(fileId: bigint, errors: ReadonlyArray<CsvRowError>, totalErrors: number): Effect.Effect<void>
  /** The files of the batch not finished yet: pending or running. */
  unfinishedCount(batchId: bigint): Effect.Effect<number>
}>()("voca/library/ImportBatches") {}

/** Jobs for the worker: one per file, whose body is the file id. */
export class ImportQueue extends Context.Service<ImportQueue, {
  put(fileId: bigint): Effect.Effect<void>
}>()("voca/library/ImportQueue") {}

/** Import progress, published to the Learner's open streams. */
export class ImportNotifier extends Context.Service<ImportNotifier, {
  publish(learnerId: bigint, event: ImportEvent): Effect.Effect<void>
  /** The events published for the Learner from the moment the stream runs. */
  events(learnerId: bigint): Stream.Stream<ImportEvent>
}>()("voca/library/ImportNotifier") {}

/** Single-use tickets that open an event stream for one Learner. */
export class ImportTickets extends Context.Service<ImportTickets, {
  issue(learnerId: bigint): Effect.Effect<string>
  /** The Learner the ticket was issued to; None when it is unknown, used or expired. Redeeming it uses it up. */
  redeem(ticket: string): Effect.Effect<Option.Option<bigint>>
}>()("voca/library/ImportTickets") {}
