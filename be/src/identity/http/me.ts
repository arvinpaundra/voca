import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { NotFound, VocaApi } from "@voca/contract"
import { getMe } from "../application/getMe.ts"
import type { LearnerRepo } from "../application/ports.ts"
import { updateSettings } from "../application/updateSettings.ts"
import { toLearner } from "../domain/learner.ts"

export const MeHandlers = HttpApiBuilder.group(
  VocaApi,
  "me",
  Effect.fn(function* (handlers) {
    // Handlers run per request: capture the ports once here (not inside each handler) and provide them to the use case.
    const ports = yield* Effect.context<LearnerRepo>()
    return handlers.handleAll({
      get: () =>
        getMe.pipe(
          Effect.provideContext(ports),
          Effect.map(toLearner),
          Effect.catchTag("LearnerNotFound", () => Effect.fail(new NotFound({ message: "Learner not found" })))
        ),
      // The contract declares no not-found error for PATCH /me/settings, so a vanished Learner is a defect.
      updateSettings: ({ payload }) =>
        updateSettings(payload).pipe(
          Effect.provideContext(ports),
          Effect.map(toLearner),
          Effect.orDie
        )
    })
  })
)
