import { Clock, Effect, Option, Result } from "effect"
import { SLUG_LENGTH } from "@voca/contract"
import { CsvRejected } from "../domain/errors.ts"
import { deckTitleOf } from "../domain/imports.ts"
import { newSlug } from "../domain/slug.ts"
import { Transaction } from "../../shared/transaction.ts"
import { newWordDrafts, readRows, rejected } from "./csv.ts"
import { DeckRepo } from "./deckRepo.ts"
import { ImportBatches, ImportNotifier } from "./importsPorts.ts"
import type { StoredFile } from "./importsPorts.ts"
import { WordRepo } from "./wordRepo.ts"

type FileNeeds = ImportBatches | ImportNotifier | DeckRepo | WordRepo | Transaction

/**
 * Imports one file, once. A file that is done or failed is skipped: its job comes back after a crash, and the
 * import must not run twice. A file that is gone (its batch was reset) is skipped too.
 */
export const importFile = (fileId: bigint): Effect.Effect<void, never, FileNeeds> => {
  return Effect.gen(function* () {
    const batches = yield* ImportBatches
    const found = yield* batches.findFile(fileId)

    if (Option.isNone(found)) {
      return
    }

    const file = found.value

    if (file.status === "pending" || file.status === "running") {
      yield* importPending(file)
    }

    yield* announce(file)
  })
}

const importPending = (file: StoredFile) => {
  return Effect.gen(function* () {
    const batches = yield* ImportBatches
    const notifier = yield* ImportNotifier

    if (file.content === null) {
      return yield* Effect.die(`import file ${file.id} has no content to read`)
    }

    yield* batches.markRunning(file.id)
    yield* notifier.publish(file.learnerId, { batch: file.batchSlug, status: "running" })

    // A rejected file creates no deck; the others of the batch still do.
    const result = yield* Effect.result(importRows(file, file.content))

    if (Result.isFailure(result)) {
      yield* batches.markFailed(file.id, result.failure.errors, result.failure.totalErrors)
    }
  })
}

/** The deck and its words, and the file marked done, in one transaction: a crash between them can't leave half. */
const importRows = (file: StoredFile, content: Uint8Array): Effect.Effect<void, CsvRejected, FileNeeds> => {
  return Effect.gen(function* () {
    const title = deckTitleOf(file.name)

    if (Option.isNone(title)) {
      return yield* Effect.fail(
        rejected("Nothing was imported. The file name leaves no deck name.", [
          { row: 1, column: null, message: "The file name is empty once its extension is dropped" }
        ])
      )
    }

    const rows = yield* readRows(content)
    const decks = yield* DeckRepo
    const words = yield* WordRepo
    const batches = yield* ImportBatches
    const transaction = yield* Transaction
    const createdAt = yield* Clock.currentTimeMillis
    const drafts = yield* newWordDrafts(rows, createdAt)
    const deckSlug = yield* newSlug(SLUG_LENGTH.deck)

    yield* transaction.run(
      Effect.gen(function* () {
        const created = yield* decks.insert(file.learnerId, {
          slug: deckSlug,
          title: title.value,
          description: "",
          termLang: file.termLang,
          meaningLang: file.meaningLang,
          createdAt,
          forkedFromId: null
        })
        const imported = yield* words.insertNew(created.id, drafts)

        yield* batches.markDone(file.id, {
          deckId: created.id,
          imported,
          skippedDuplicates: drafts.length - imported
        })
      })
    )
  })
}

/** After each file: `finished` when the batch has no file left to import, otherwise `running`. */
const announce = (file: StoredFile) => {
  return Effect.gen(function* () {
    const batches = yield* ImportBatches
    const notifier = yield* ImportNotifier
    const unfinished = yield* batches.unfinishedCount(file.batchId)

    yield* notifier.publish(file.learnerId, {
      batch: file.batchSlug,
      status: unfinished === 0 ? "finished" : "running"
    })
  })
}
