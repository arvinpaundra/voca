import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { RefreshTokenInvalid, Unauthorized, VocaApi } from "@voca/contract"
import type { Transaction } from "../../shared/transaction.ts"
import { logout } from "../application/logout.ts"
import type { GoogleOAuth, LearnerRepo, RefreshTokens, TokenSigner } from "../application/ports.ts"
import { refresh } from "../application/refresh.ts"
import { signInWithGoogle } from "../application/signInWithGoogle.ts"
import { toLearner } from "../domain/learner.ts"

/** Public `/auth/*` endpoints. Each one only maps its use case's result and errors to the contract. */
export const AuthHandlers = HttpApiBuilder.group(
  VocaApi,
  "auth",
  Effect.fn(function* (handlers) {
    const ports = yield* Effect.context<GoogleOAuth | LearnerRepo | TokenSigner | RefreshTokens | Transaction>()
    return handlers.handleAll({
      google: ({ payload }) =>
        signInWithGoogle(payload).pipe(
          Effect.provideContext(ports),
          Effect.map(({ learner, ...tokens }) => ({ ...tokens, learner: toLearner(learner) })),
          Effect.catchTag("GoogleSignInFailed", () => Effect.fail(new Unauthorized({ message: "Google sign-in failed" })))
        ),
      refresh: ({ payload }) =>
        refresh(payload.refreshToken).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("RefreshTokenRejected", () =>
            Effect.fail(new RefreshTokenInvalid({ message: "Refresh token is invalid, expired or revoked" }))
          )
        ),
      logout: ({ payload }) => logout(payload.refreshToken).pipe(Effect.provideContext(ports))
    })
  })
)
