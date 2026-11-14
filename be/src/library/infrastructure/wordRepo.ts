import { Effect, Layer } from "effect"
import { WordRepo } from "../application/wordRepo.ts"

/** Not implemented yet: task LB. */
export const WordRepoLive = Layer.succeed(
  WordRepo,
  WordRepo.of({
    findOwnedDeckId: () => Effect.die("not implemented: LB"),
    findOwned: () => Effect.die("not implemented: LB"),
    list: () => Effect.die("not implemented: LB"),
    insert: () => Effect.die("not implemented: LB"),
    update: () => Effect.die("not implemented: LB"),
    softDelete: () => Effect.die("not implemented: LB")
  })
)
