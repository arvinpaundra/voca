import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { VocaApi } from "@voca/contract"

// Stubs for the study task. The Hard Words endpoints arrive with a later feature.
export const StudyHandlers = HttpApiBuilder.group(
  VocaApi,
  "study",
  Effect.fn(function* (handlers) {
    return handlers.handleAll({
      deckDrills: () => Effect.die("not implemented: SB"),
      start: () => Effect.die("not implemented: SB"),
      active: () => Effect.die("not implemented: SB"),
      answer: () => Effect.die("not implemented: SB"),
      abandon: () => Effect.die("not implemented: SB"),
      hardWords: () => Effect.die("not implemented: hard words"),
      markHard: () => Effect.die("not implemented: hard words"),
      unmarkHard: () => Effect.die("not implemented: hard words")
    })
  })
)
