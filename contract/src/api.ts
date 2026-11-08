import { Context } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSchema, HttpApiSecurity, OpenApi } from "effect/http-api"
import { CommunityGroup } from "./community.ts"
import { Unauthorized } from "./errors.ts"
import { AuthGroup, MeGroup } from "./identity.ts"
import { InsightGroup } from "./insight.ts"
import { LibraryGroup } from "./library.ts"
import type { LearnerSlug } from "./slug.ts"
import { StudyGroup } from "./study.ts"

/**
 * The signed-in Learner, provided to handlers by the backend's Authorization middleware.
 * `id` is the internal bigint: it lives only in server memory and is never serialized.
 */
export class CurrentLearner extends Context.Service<CurrentLearner, {
  readonly id: bigint
  readonly slug: LearnerSlug
}>()("voca/CurrentLearner") {}

/** Bearer access token → CurrentLearner, or 401 Unauthorized. */
export class Authorization extends HttpApiMiddleware.Service<Authorization, { provides: CurrentLearner; requires: never }>()(
  "voca/Authorization",
  { security: { bearer: HttpApiSecurity.bearer }, error: Unauthorized }
) {}

/** `GET /api/healthz`: 204 when `SELECT 1` succeeds. Public. */
export class SystemGroup extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("healthz", "/healthz", { success: HttpApiSchema.NoContent })
) {}

/**
 * The whole HTTP contract. The backend implements it with `HttpApiBuilder`;
 * the frontend calls it through `HttpApiClient.make(VocaApi)`.
 * Same origin as the SPA, everything under `/api` (ADR 21).
 */
export class VocaApi extends HttpApi.make("voca")
  .add(SystemGroup)
  .add(AuthGroup)
  .add(MeGroup.middleware(Authorization))
  .add(LibraryGroup.middleware(Authorization))
  .add(CommunityGroup.middleware(Authorization))
  .add(StudyGroup.middleware(Authorization))
  .add(InsightGroup.middleware(Authorization))
  .prefix("/api")
  .annotateMerge(OpenApi.annotations({ title: "Voca API" }))
{}
