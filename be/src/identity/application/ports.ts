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
  /** Creates the Learner for this Google account with the new-Learner defaults, or refreshes the profile of the existing one. */
  upsertGoogle(profile: GoogleProfile, timezone: LearnerSettings["timezone"]): Effect.Effect<LearnerRecord>
  saveSettings(id: bigint, settings: LearnerSettings): Effect.Effect<void>
  /** Soft-deletes the Learner at `at` (epoch millis) and blanks the identifying columns: name, email, photo and Google ID. */
  erase(id: bigint, at: number): Effect.Effect<void>
}>()("voca/identity/LearnerRepo") {}

/** What a Learner owns in the library, erased with the account. Its implementation lives in the library context. */
export class LearnerLibrary extends Context.Service<LearnerLibrary, {
  /** Soft-deletes every live deck the Learner owns as `deleteDeck` does, and fails their pending imports. `at` is epoch millis. */
  eraseAllOf(learnerId: bigint, at: number): Effect.Effect<void>
}>()("voca/identity/LearnerLibrary") {}

export class InvalidToken extends Data.TaggedError("InvalidToken")<{}> {}

/** Access tokens: HS256 JWT, `sub` = the learner's slug, 15 minutes. */
export class TokenSigner extends Context.Service<TokenSigner, {
  sign(slug: LearnerSlug): Effect.Effect<{ readonly token: string; readonly expiresIn: number }>
  verify(token: string): Effect.Effect<LearnerSlug, InvalidToken>
}>()("voca/identity/TokenSigner") {}

export class GoogleSignInFailed extends Data.TaggedError("GoogleSignInFailed")<{ readonly reason: string }> {}

/** Exchanges the authorization code at Google's token endpoint and checks the ID token. */
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
 * Refresh tokens: opaque, 32 random bytes as base64url; only their sha256 is stored.
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
  /** Revokes every token of the Learner that isn't revoked yet, whatever its family. */
  revokeAllOf(learnerId: bigint): Effect.Effect<void>
}>()("voca/identity/RefreshTokens") {}
