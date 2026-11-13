import { Effect, Layer, Redacted } from "effect"
import { Authorization, CurrentLearner, Unauthorized } from "@voca/contract"
import { authenticate } from "../application/authenticate.ts"
import type { LearnerRepo, TokenSigner } from "../application/ports.ts"

/** Bearer access token → `CurrentLearner` for the handler, or `401 Unauthorized`. */
export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    // The middleware runs per request, so capture the ports once here and hand them to the use case.
    const ports = yield* Effect.context<LearnerRepo | TokenSigner>()
    return Authorization.of({
      bearer: Effect.fn(function* (httpEffect, { credential }) {
        const learner = yield* authenticate(Redacted.value(credential)).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("Unauthenticated", () => Effect.fail(new Unauthorized({ message: "Missing, invalid or expired token" })))
        )
        return yield* Effect.provideService(httpEffect, CurrentLearner, { id: learner.id, slug: learner.slug })
      })
    })
  })
)
