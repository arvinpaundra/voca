import { Data } from "effect"

/** Any refresh-token problem: unknown, expired, revoked, or reused (which also revokes its family). One error on purpose. */
export class RefreshTokenRejected extends Data.TaggedError("RefreshTokenRejected")<{}> {}

/** What Voca keeps from a Google sign-in: the ID token's claims once they are checked. */
export interface GoogleProfile {
  readonly sub: string
  readonly email: string
  readonly name: string
  readonly avatarUrl: string | null
}
