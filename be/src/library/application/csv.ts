import { Clock, Effect, Result } from "effect"
import { CurrentLearner, SLUG_LENGTH } from "@voca/contract"
import type { ColumnMatch, ImportResult } from "@voca/contract"
import { parseCsv, toCsv } from "../domain/csv.ts"
import { DeckNotFound, CsvRejected } from "../domain/errors.ts"
import type { CsvRowError } from "../domain/errors.ts"
import { readWords } from "../domain/csvWords.ts"
import type { CsvWordRow } from "../domain/csvWords.ts"
import { newSlug } from "../domain/slug.ts"
import { Transaction } from "../../shared/transaction.ts"
import { findOwnedDeckId, newWordOf } from "./words.ts"
import { WordRepo } from "./wordRepo.ts"

type ImportNeeds = CurrentLearner | WordRepo | Transaction

const MAX_REPORTED_ERRORS = 100

/** Columns of an export, the same names the import reads. */
const EXPORT_HEADER: ReadonlyArray<string> = ["term", "meaning", "reading", "example", "notes"]

/** The rejection of an upload: the first `MAX_REPORTED_ERRORS` problems, and the count of all of them. */
export const rejected = (message: string, errors: ReadonlyArray<CsvRowError>): CsvRejected => {
  return new CsvRejected({
    message,
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
    totalErrors: errors.length
  })
}

export const decodeText = (bytes: Uint8Array): Effect.Effect<string, CsvRejected> => {
  return Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () =>
      rejected("Nothing was imported. Save as CSV UTF-8 and upload it again.", [
        { row: 1, column: null, message: "The file isn't UTF-8 text" }
      ])
  })
}

export const parseText = (text: string): Effect.Effect<ReadonlyArray<ReadonlyArray<string>>, CsvRejected> => {
  const parsed = parseCsv(text)

  return Result.isFailure(parsed)
    ? Effect.fail(
      rejected("Nothing was imported. The file isn't valid CSV.", [
        { row: parsed.failure.row, column: null, message: parsed.failure.message }
      ])
    )
    : Effect.succeed(parsed.success)
}

export const readRows = (
  bytes: Uint8Array,
  columns?: ColumnMatch
): Effect.Effect<ReadonlyArray<CsvWordRow>, CsvRejected> => {
  return Effect.fail(
    rejected(`not implemented: LB (${bytes.length} bytes, ${columns?.length ?? 0} columns)`, [
      { row: 1, column: null, message: "not implemented: LB" }
    ])
  )
}

/** New words for the rows: a fresh slug each, all stamped with the same clock time. */
export const newWordDrafts = (rows: ReadonlyArray<CsvWordRow>, createdAt: number) => {
  return Effect.forEach(rows, (row) => Effect.map(newSlug(SLUG_LENGTH.word), (slug) => newWordOf(slug, row, createdAt)))
}

/**
 * Imports every row of a CSV file into the Learner's deck, or nothing: any problem rejects the whole file. Rows whose
 * keys a live word of the deck already holds, or an earlier row of the file holds, are skipped and counted.
 */
export const importCsv = (
  deckSlug: string,
  bytes: Uint8Array
): Effect.Effect<ImportResult, DeckNotFound | CsvRejected, ImportNeeds> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const words = yield* WordRepo
    const transaction = yield* Transaction
    const deckId = yield* findOwnedDeckId(id, deckSlug)
    const rows = yield* readRows(bytes)
    const createdAt = yield* Clock.currentTimeMillis
    const drafts = yield* newWordDrafts(rows, createdAt)
    const written = yield* transaction.run(words.insertNew(deckId, drafts))

    return { imported: written, skippedDuplicates: drafts.length - written }
  })

/** The deck's live words as CSV, oldest first, in the format the import reads back. */
export const exportCsv = (deckSlug: string): Effect.Effect<string, DeckNotFound, CurrentLearner | WordRepo> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const words = yield* WordRepo
    const deckId = yield* findOwnedDeckId(id, deckSlug)
    const live = yield* words.listLive(deckId)
    const body = live.map((word) => [word.term, word.meaning, word.reading ?? "", word.example ?? "", word.notes ?? ""])

    return toCsv([EXPORT_HEADER, ...body])
  })
