import type { DateTime, Effect, Option } from "effect"
import { Context, Data } from "effect"
import type { LearnerSettings, LearnerSlug } from "@voca/contract"
import type { GoogleProfile } from "../domain/auth.ts"
import type { LearnerRecord } from "../domain/learner.ts"

export type { GoogleProfile }

/** Ports have exactly one implementation each, in `infrastructure/`; tests swap in other layers. Infra failures are defects. */
export class LearnerRepo extends Context.Service<LearnerRepo, {
  findBySlug(slug: LearnerSlug): Effect.Effect<Option.Option<LearnerRecord>>
  findById(id: bigint): Effect.Effect<Option.Option<LearnerRecord>>
  saveSettings(id: bigint, settings: LearnerSettings): Effect.Effect<void>
}>()("voca/identity/LearnerRepo") {}

export class InvalidToken extends Data.TaggedError("InvalidToken")<{}> {}

/** Access tokens (docs/08): HS256 JWT, `sub` = the learner's slug, 15 minutes. */
export class TokenSigner extends Context.Service<TokenSigner, {
  sign(slug: LearnerSlug): Effect.Effect<{ readonly token: string; readonly expiresIn: number }>
  verify(token: string): Effect.Effect<LearnerSlug, InvalidToken>
}>()("voca/identity/TokenSigner") {}

export class GoogleSignInFailed extends Data.TaggedError("GoogleSignInFailed")<{ readonly reason: string }> {}

/** Exchanges the authorization code at Google's token endpoint and checks the ID token (docs/08 steps 5-6). */
export class GoogleOAuth extends Context.Service<GoogleOAuth, {
  exchange(input: {
    readonly code: string
    readonly codeVerifier: string
    readonly redirectUri: string
  }): Effect.Effect<GoogleProfile, GoogleSignInFailed>
}>()("voca/identity/GoogleOAuth") {}

export interface RefreshTokenRecord {
  readonly id: bigint
  readonly learnerId: bigint
  readonly familyId: string
  readonly expiresAt: DateTime.Utc
  readonly usedAt: DateTime.Utc | null
  readonly revokedAt: DateTime.Utc | null
}

/**
 * Refresh tokens (docs/08): opaque, 32 random bytes as base64url; only their sha256 is stored.
 * Rotation and reuse detection are the use cases' job; this port only stores and finds.
 */
export class RefreshTokens extends Context.Service<RefreshTokens, {
  /** A new token valid 30 days from now, in `familyId`, or in a new family when it is omitted. */
  issue(learnerId: bigint, familyId?: string): Effect.Effect<{ readonly token: string; readonly familyId: string }>
  /** The row for this token, locked until the surrounding `Transaction` ends. None when the token is unknown. */
  findForUpdate(token: string): Effect.Effect<Option.Option<RefreshTokenRecord>>
  markUsed(id: bigint): Effect.Effect<void>
  /** Revokes every token of the family that isn't revoked yet. */
  revokeFamily(familyId: string): Effect.Effect<void>
}>()("voca/identity/RefreshTokens") {}
