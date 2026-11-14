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
      deckStats: () => Effect.die("not implemented: IB"),
      learnerStats: () => Effect.die("not implemented: IB"),
      notifications: () => Effect.die("not implemented: IB"),
      activity: () => Effect.die("not implemented: IB")
    })
  })
)
