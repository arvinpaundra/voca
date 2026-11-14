import { Effect, Layer } from "effect"
import { DeckRepo } from "../application/deckRepo.ts"

/** Not implemented yet: task LD. */
export const DeckRepoLive = Layer.succeed(
  DeckRepo,
  DeckRepo.of({
    listOwned: () => Effect.die("not implemented"),
    findOwned: () => Effect.die("not implemented"),
    insert: () => Effect.die("not implemented"),
    update: () => Effect.die("not implemented"),
    hasWords: () => Effect.die("not implemented"),
    softDelete: () => Effect.die("not implemented")
  })
)
