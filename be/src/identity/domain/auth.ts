import { Data, Result } from "effect"

/** Any refresh-token problem: unknown, expired, revoked, or reused (which also revokes its family). One error on purpose. */
export class RefreshTokenRejected extends Data.TaggedError("RefreshTokenRejected")<{}> {}

/** What Voca keeps from a Google sign-in: the ID token's claims once they are checked. */
export interface GoogleProfile {
  readonly sub: string
  readonly email: string
  readonly name: string
  readonly avatarUrl: string | null
}

/**
 * Checks the claims of an ID token that came straight from Google's token endpoint over TLS, so its signature isn't
 * checked (OIDC Core §3.1.3.7, docs/08 step 6): `iss` is Google, `aud` is our client ID, `exp` is in the future, and
 * the email is verified. Returns the profile, or a short reason. Not implemented yet: task B2.
 */
export const checkIdTokenClaims = (
  _claims: unknown,
  _expected: { readonly clientId: string; readonly nowSeconds: number }
): Result.Result<GoogleProfile, string> => Result.fail("not implemented")
