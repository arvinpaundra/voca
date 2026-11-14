import { Data, Result, Schema } from "effect"

/** Any refresh-token problem: unknown, expired, revoked, or reused (which also revokes its family). One error on purpose. */
export class RefreshTokenRejected extends Data.TaggedError("RefreshTokenRejected")<{}> {}

/** What Voca keeps from a Google sign-in: the ID token's claims once they are checked. */
export interface GoogleProfile {
  readonly sub: string
  readonly email: string
  readonly name: string
  readonly avatarUrl: string | null
}

/** The claims Voca reads from a Google ID token; the rest are ignored. */
const GoogleClaims = Schema.Struct({
  iss: Schema.Literals(["https://accounts.google.com", "accounts.google.com"]),
  aud: Schema.String,
  exp: Schema.Number,
  sub: Schema.String,
  email: Schema.String,
  email_verified: Schema.Literal(true),
  name: Schema.optionalKey(Schema.String),
  picture: Schema.optionalKey(Schema.String)
})

/**
 * Checks the claims of an ID token that came straight from Google's token endpoint over TLS, so its signature isn't
 * checked (OIDC Core §3.1.3.7): `iss` is Google, `aud` is our client ID, `exp` is in the future, and
 * the email is verified. Returns the profile, or a short reason.
 */
export const checkIdTokenClaims = (
  claims: unknown,
  expected: { readonly clientId: string; readonly nowSeconds: number }
): Result.Result<GoogleProfile, string> => {
  const decoded = Schema.decodeUnknownResult(GoogleClaims)(claims)
  if (Result.isFailure(decoded)) return Result.fail("claims are missing or invalid")
  const { sub, email, name, picture, aud, exp } = decoded.success
  if (aud !== expected.clientId) return Result.fail("audience is not this client")
  if (exp <= expected.nowSeconds) return Result.fail("ID token has expired")
  return Result.succeed({ sub, email, name: name ?? email, avatarUrl: picture ?? null })
}
