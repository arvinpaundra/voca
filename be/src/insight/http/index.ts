import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { NotFound, VocaApi } from "@voca/contract"
import { activity } from "../application/activity.ts"
import { deckStats } from "../application/deckStats.ts"
import { learnerStats } from "../application/learnerStats.ts"
import { notifications } from "../application/notifications.ts"
import type { InsightRepo } from "../application/insightRepo.ts"
import { wordStats } from "../application/wordStats.ts"

// Each endpoint calls its use case and maps the domain error to the contract's.
export const InsightHandlers = HttpApiBuilder.group(
  VocaApi,
  "insight",
  Effect.fn(function* (handlers) {
    const ports = yield* Effect.context<InsightRepo>()

    return handlers.handleAll({
      wordStats: ({ params }) =>
        wordStats(params.wordSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("WordNotFound", () => Effect.fail(new NotFound({ message: "Word not found" })))
        ),

      deckStats: ({ params }) =>
        deckStats(params.deckSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", () => Effect.fail(new NotFound({ message: "Deck not found" })))
        ),

      learnerStats: () => learnerStats.pipe(Effect.provideContext(ports)),

      notifications: () => notifications.pipe(Effect.provideContext(ports)),

      activity: ({ query }) => activity(query.month).pipe(Effect.provideContext(ports))
    })
  })
)
