import { describe, expect, test } from "bun:test"
import { Result } from "effect"
import { checkIdTokenClaims } from "../src/identity/domain/auth.ts"

// The ID token comes straight from Google's token endpoint over TLS, so only its claims are checked.
const CLIENT_ID = "123.apps.googleusercontent.com"
const NOW = 1_800_000_000
const valid = {
  iss: "https://accounts.google.com", aud: CLIENT_ID, exp: NOW + 600, iat: NOW,
  sub: "1099", email: "ada@example.com", email_verified: true, name: "Ada Lovelace", picture: "https://lh3.googleusercontent.com/a/ada"
}
const check = (claims: unknown) => checkIdTokenClaims(claims, { clientId: CLIENT_ID, nowSeconds: NOW })

describe("checkIdTokenClaims", () => {
  test("accepts valid claims and keeps sub, email, name and picture", () => {
    expect(check(valid)).toEqual(
      Result.succeed({ sub: "1099", email: "ada@example.com", name: "Ada Lovelace", avatarUrl: "https://lh3.googleusercontent.com/a/ada" })
    )
  })

  test("accepts Google's short issuer form", () => {
    expect(Result.isSuccess(check({ ...valid, iss: "accounts.google.com" }))).toBe(true)
  })

  test("without a name, uses the email; without a picture, the avatar is null", () => {
    const { name: _n, picture: _p, ...rest } = valid
    expect(check(rest)).toEqual(Result.succeed({ sub: "1099", email: "ada@example.com", name: "ada@example.com", avatarUrl: null }))
  })

  test.each([
    ["another issuer", { ...valid, iss: "https://evil.example.com" }],
    ["another audience", { ...valid, aud: "someone-else.apps.googleusercontent.com" }],
    ["expired", { ...valid, exp: NOW }],
    ["unverified email", { ...valid, email_verified: false }],
    ["no email_verified claim", (({ email_verified: _, ...rest }) => rest)(valid)],
    ["no sub", (({ sub: _, ...rest }) => rest)(valid)],
    ["no email", (({ email: _, ...rest }) => rest)(valid)],
    ["not an object", "eyJhbGciOi..."]
  ] as const)("rejects %s", (_, claims) => {
    expect(Result.isFailure(check(claims))).toBe(true)
  })
})
