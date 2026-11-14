import { Data } from "effect"

/** Any refresh-token problem: unknown, expired, revoked, or reused (which also revokes its family). One error on purpose. */
export class RefreshTokenRejected extends Data.TaggedError("RefreshTokenRejected")<{}> {}
