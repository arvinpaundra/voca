import { Effect, Layer } from "effect"
import { WordRepo } from "../application/wordRepo.ts"

/** Not implemented yet: task LW. */
export const WordRepoLive = Layer.succeed(
  WordRepo,
  WordRepo.of({
    findOwnedDeckId: () => Effect.die("not implemented"),
    findOwned: () => Effect.die("not implemented"),
    list: () => Effect.die("not implemented"),
    insert: () => Effect.die("not implemented"),
    update: () => Effect.die("not implemented"),
    softDelete: () => Effect.die("not implemented")
  })
)
