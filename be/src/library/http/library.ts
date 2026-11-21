import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import {
  DuplicateWord,
  DuplicateWords,
  Forbidden,
  IMPORT_MAX_BYTES,
  ImportRejected,
  NotFound,
  PayloadTooLarge,
  VocaApi
} from "@voca/contract"
import { createDeck, deleteDeck, deleteDecks, getDeck, listDecks, publishDeck, unpublishDeck, updateDeck } from "../application/decks.ts"
import type { DeckRepo } from "../application/deckRepo.ts"
import { exportCsv as exportWords, importCsv as importWords } from "../application/csv.ts"
import { flashcards } from "../application/flashcards.ts"
import { snoozeDecks, unsnoozeDecks } from "../application/snooze.ts"
import { createWord, createWords, deleteWord, listWords, updateWord } from "../application/words.ts"
import type { WordRepo } from "../application/wordRepo.ts"
import type { Transaction } from "../../shared/transaction.ts"

const notFound = (what: string) => () => Effect.fail(new NotFound({ message: `${what} not found` }))

const duplicate = () =>
  Effect.fail(new DuplicateWord({ message: "This deck already has a word with the same term and reading" }))

const termLangLocked = () =>
  Effect.fail(new Forbidden({ message: "The term language can't change once the deck has words" }))

// Each endpoint calls its use case and maps the domain errors to the contract's.
export const LibraryHandlers = HttpApiBuilder.group(
  VocaApi,
  "library",
  Effect.fn(function* (handlers) {
    const ports = yield* Effect.context<DeckRepo | WordRepo | Transaction>()

    return handlers.handleAll({
      listDecks: () => listDecks.pipe(Effect.provideContext(ports)),

      createDeck: ({ payload }) => createDeck(payload).pipe(Effect.provideContext(ports)),

      getDeck: ({ params }) =>
        getDeck(params.deckSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      updateDeck: ({ params, payload }) =>
        updateDeck(params.deckSlug, payload).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck")),
          Effect.catchTag("TermLangLocked", termLangLocked)
        ),

      deleteDeck: ({ params }) =>
        deleteDeck(params.deckSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      listWords: ({ params, query }) =>
        listWords(params.deckSlug, query).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      createWord: ({ params, payload }) =>
        createWord(params.deckSlug, payload).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck")),
          Effect.catchTag("DuplicateWordError", duplicate)
        ),

      createWords: ({ params, payload }) =>
        createWords(params.deckSlug, payload.words).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck")),
          Effect.catchTag("DuplicateWordsError", (error) =>
            Effect.fail(
              new DuplicateWords({
                message: "These words collide with the deck or with each other, so none was saved",
                indexes: error.indexes
              })
            ))
        ),

      updateWord: ({ params, payload }) =>
        updateWord(params.wordSlug, payload).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("WordNotFound", notFound("Word")),
          Effect.catchTag("DuplicateWordError", duplicate)
        ),

      deleteWord: ({ params }) =>
        deleteWord(params.wordSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("WordNotFound", notFound("Word"))
        ),

      publishDeck: ({ params }) =>
        publishDeck(params.deckSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      unpublishDeck: ({ params }) =>
        unpublishDeck(params.deckSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      snoozeDecks: ({ payload }) =>
        snoozeDecks(payload).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      deleteDecks: ({ payload }) => deleteDecks(payload).pipe(Effect.provideContext(ports)),

      unsnoozeDecks: ({ payload }) =>
        unsnoozeDecks(payload).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      flashcards: ({ params, query }) =>
        flashcards(params.deckSlug, query.size).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      // The size is checked here, before the file is read: the framework's own limit does not apply to every caller.
      importCsv: ({ params, payload }) =>
        Effect.gen(function* () {
          const upload = Bun.file(payload.file.path)

          if (upload.size > IMPORT_MAX_BYTES) {
            return yield* Effect.fail(new PayloadTooLarge({ message: "A CSV file can be at most 5 MB" }))
          }

          const bytes = yield* Effect.tryPromise({
            try: () => upload.bytes(),
            catch: (cause) => cause
          }).pipe(Effect.orDie)

          return yield* importWords(params.deckSlug, bytes)
        }).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck")),
          Effect.catchTag("CsvRejected", (error) =>
            Effect.fail(
              new ImportRejected({
                message: error.message,
                errors: error.errors,
                totalErrors: error.totalErrors
              })
            ))
        ),

      exportCsv: ({ params }) =>
        exportWords(params.deckSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        )
    })
  })
)
