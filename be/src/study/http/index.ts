import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { VocaApi } from "@voca/contract"

// Placeholder until the study task builds these: every endpoint answers 500, so the group is routed.
export const StudyHandlers = HttpApiBuilder.group(
  VocaApi,
  "study",
  Effect.fn(function* (handlers) {
    return handlers.handleAll({
      start: () => Effect.die("not implemented"),
      active: () => Effect.die("not implemented"),
      answer: () => Effect.die("not implemented"),
      abandon: () => Effect.die("not implemented"),
      hardWords: () => Effect.die("not implemented"),
      markHard: () => Effect.die("not implemented"),
      unmarkHard: () => Effect.die("not implemented")
    })
  })
)
