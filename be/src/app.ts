import { Layer, Redacted } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { VocaApi } from "@voca/contract"
import { AuthHandlers } from "./identity/http/auth.ts"
import { AuthorizationLive } from "./identity/http/authorization.ts"
import { MeHandlers } from "./identity/http/me.ts"
import { LearnerRepoLive } from "./identity/infrastructure/learnerRepo.ts"
import { RefreshTokensLive } from "./identity/infrastructure/refreshTokens.ts"
import { TokenSignerLive } from "./identity/infrastructure/tokenSigner.ts"
import { CommunityHandlers } from "./library/http/community.ts"
import { LibraryHandlers } from "./library/http/library.ts"
import { InsightHandlers } from "./insight/http/index.ts"
import { StudyHandlers } from "./study/http/index.ts"
import { SystemHandlers } from "./shared/http/system.ts"
import { TransactionLive } from "./shared/transaction.ts"

/**
 * The whole API as one layer: `VocaApi` with every group's handlers, the Authorization middleware and the identity
 * infrastructure. It still needs a `SqlClient` and a `GoogleOAuth` from outside (main.ts gives the real ones, tests stubs).
 */
export const makeApiLayer = (options: { readonly jwtSecret: Redacted.Redacted<string> }) => {
  const groups = Layer.mergeAll(
    SystemHandlers,
    AuthHandlers,
    MeHandlers,
    LibraryHandlers,
    CommunityHandlers,
    StudyHandlers,
    InsightHandlers
  )
  const infra = Layer.mergeAll(LearnerRepoLive, RefreshTokensLive, TransactionLive, TokenSignerLive(options.jwtSecret))
  return HttpApiBuilder.layer(VocaApi).pipe(
    Layer.provide(groups),
    Layer.provide(AuthorizationLive),
    Layer.provide(infra)
  )
}
