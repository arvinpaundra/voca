import type { Effect, Option } from "effect"
import { Context, Data } from "effect"
import type { LearnerSlug } from "@voca/contract"
import type { LearnerRecord } from "../domain/learner.ts"

/** Ports have exactly one implementation each, in `infrastructure/`; tests swap in other layers. Infra failures are defects. */
export class LearnerRepo extends Context.Service<LearnerRepo, {
  findBySlug(slug: LearnerSlug): Effect.Effect<Option.Option<LearnerRecord>>
}>()("voca/identity/LearnerRepo") {}

export class InvalidToken extends Data.TaggedError("InvalidToken")<{}> {}

/** Access tokens (docs/08): HS256 JWT, `sub` = the learner's slug, 15 minutes. */
export class TokenSigner extends Context.Service<TokenSigner, {
  sign(slug: LearnerSlug): Effect.Effect<{ readonly token: string; readonly expiresIn: number }>
  verify(token: string): Effect.Effect<LearnerSlug, InvalidToken>
}>()("voca/identity/TokenSigner") {}
