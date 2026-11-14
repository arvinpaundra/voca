import { Effect, Layer } from "effect"
import { DeckRepo } from "../application/deckRepo.ts"

/** Not implemented yet: task LB. */
export const DeckRepoLive = Layer.succeed(
  DeckRepo,
  DeckRepo.of({
    listOwned: () => Effect.die("not implemented: LB"),
    findOwned: () => Effect.die("not implemented: LB"),
    insert: () => Effect.die("not implemented: LB"),
    update: () => Effect.die("not implemented: LB"),
    hasWords: () => Effect.die("not implemented: LB"),
    softDelete: () => Effect.die("not implemented: LB")
  })
)
