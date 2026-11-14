import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { DuplicateWord, Forbidden, NotFound, VocaApi } from "@voca/contract"
import { createDeck, deleteDeck, getDeck, listDecks, updateDeck } from "../application/decks.ts"
import type { DeckRepo } from "../application/deckRepo.ts"
import { createWord, deleteWord, listWords, updateWord } from "../application/words.ts"
import type { WordRepo } from "../application/wordRepo.ts"
import type { Transaction } from "../../shared/transaction.ts"

const notFound = (what: string) => () => Effect.fail(new NotFound({ message: `${what} not found` }))

const duplicate = () =>
  Effect.fail(new DuplicateWord({ message: "This deck already has a word with the same term and reading" }))

const termLangLocked = () =>
  Effect.fail(new Forbidden({ message: "The term language can't change once the deck has words" }))

// Each endpoint calls its use case and maps the domain errors to the contract's.
// Publishing and CSV import/export belong to later features and still answer 500.
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

      publishDeck: () => Effect.die("not implemented: CB"),
      unpublishDeck: () => Effect.die("not implemented: CB"),
      importCsv: () => Effect.die("not implemented"),
      exportCsv: () => Effect.die("not implemented")
    })
  })
)
