import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { NotFound, RefreshTokenInvalid, Unauthorized } from "./errors.ts"
import { DayStartHour, DesiredRetention, Instant, Mode, NewPerDay, SessionSize, Timezone } from "./primitives.ts"
import { LearnerSlug } from "./slug.ts"

// ───── Schemas ─────

export const LearnerSettings = Schema.Struct({
  timezone: Timezone,
  dayStartHour: DayStartHour,
  desiredRetention: DesiredRetention,
  newPerDay: NewPerDay,
  defaultSessionSize: SessionSize,
  defaultMode: Mode
})
export type LearnerSettings = typeof LearnerSettings.Type

export const Learner = Schema.Struct({
  slug: LearnerSlug,
  email: Schema.String,
  name: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
  createdAt: Instant, // the frontend disables "previous month" on the activity heatmap before this
  settings: LearnerSettings
})
export type Learner = typeof Learner.Type

/** Opaque refresh token: 32 random bytes, base64url without padding. */
export const RefreshToken = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/))

export const AuthTokens = Schema.Struct({
  accessToken: Schema.String,
  refreshToken: RefreshToken,
  expiresIn: Schema.Int // seconds until the access token expires
})
export type AuthTokens = typeof AuthTokens.Type

export const GoogleSignIn = Schema.Struct({
  code: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2048)),
  codeVerifier: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9\-._~]{43,128}$/)), // RFC 7636
  redirectUri: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2048)),
  timezone: Timezone // used only when the account is created
})

export const RefreshRequest = Schema.Struct({ refreshToken: RefreshToken })

export const SignedIn = Schema.Struct({ ...AuthTokens.fields, learner: Learner })

/** Every field optional; an absent key leaves the setting unchanged. */
export const UpdateSettings = Schema.Struct({
  timezone: Schema.optionalKey(Timezone),
  dayStartHour: Schema.optionalKey(DayStartHour),
  desiredRetention: Schema.optionalKey(DesiredRetention),
  newPerDay: Schema.optionalKey(NewPerDay),
  defaultSessionSize: Schema.optionalKey(SessionSize),
  defaultMode: Schema.optionalKey(Mode)
})

// ───── Endpoints ─────

/** Public: no bearer token. */
export class AuthGroup extends HttpApiGroup.make("auth").add(
  HttpApiEndpoint.post("google", "/auth/google", { payload: GoogleSignIn, success: SignedIn, error: Unauthorized }),
  HttpApiEndpoint.post("refresh", "/auth/refresh", {
    payload: RefreshRequest,
    success: AuthTokens,
    error: RefreshTokenInvalid
  }),
  HttpApiEndpoint.post("logout", "/auth/logout", { payload: RefreshRequest, success: HttpApiSchema.NoContent })
) {}

export class MeGroup extends HttpApiGroup.make("me").add(
  HttpApiEndpoint.get("get", "/me", { success: Learner, error: NotFound }),
  HttpApiEndpoint.patch("updateSettings", "/me/settings", { payload: UpdateSettings, success: Learner })
) {}
