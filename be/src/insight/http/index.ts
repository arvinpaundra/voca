import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { VocaApi } from "@voca/contract"

// Placeholder until the insight task builds these: every endpoint answers 500, so the group is routed.
export const InsightHandlers = HttpApiBuilder.group(
  VocaApi,
  "insight",
  Effect.fn(function* (handlers) {
    return handlers.handleAll({
      wordStats: () => Effect.die("not implemented"),
      deckStats: () => Effect.die("not implemented"),
      notifications: () => Effect.die("not implemented"),
      activity: () => Effect.die("not implemented")
    })
  })
)
