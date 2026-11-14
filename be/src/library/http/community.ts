import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { VocaApi } from "@voca/contract"

// Placeholder until the community task builds these: every endpoint answers 500, so the group is routed.
export const CommunityHandlers = HttpApiBuilder.group(
  VocaApi,
  "community",
  Effect.fn(function* (handlers) {
    return handlers.handleAll({
      list: () => Effect.die("not implemented"),
      get: () => Effect.die("not implemented"),
      fork: () => Effect.die("not implemented")
    })
  })
)
