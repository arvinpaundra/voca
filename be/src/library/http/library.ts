import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { VocaApi } from "@voca/contract"

// Placeholder until the library task builds these: every endpoint answers 500, so the group is routed.
export const LibraryHandlers = HttpApiBuilder.group(
  VocaApi,
  "library",
  Effect.fn(function* (handlers) {
    return handlers.handleAll({
      listDecks: () => Effect.die("not implemented"),
      createDeck: () => Effect.die("not implemented"),
      getDeck: () => Effect.die("not implemented"),
      deckDrills: () => Effect.die("not implemented"),
      updateDeck: () => Effect.die("not implemented"),
      deleteDeck: () => Effect.die("not implemented"),
      publishDeck: () => Effect.die("not implemented"),
      unpublishDeck: () => Effect.die("not implemented"),
      listWords: () => Effect.die("not implemented"),
      createWord: () => Effect.die("not implemented"),
      updateWord: () => Effect.die("not implemented"),
      deleteWord: () => Effect.die("not implemented"),
      importCsv: () => Effect.die("not implemented"),
      exportCsv: () => Effect.die("not implemented")
    })
  })
)
