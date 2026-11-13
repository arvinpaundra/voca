import { Data, Effect, Option } from "effect"
import { LearnerRepo, TokenSigner } from "./ports.ts"

export class Unauthenticated extends Data.TaggedError("Unauthenticated")<{}> {}

/** Bearer token → the Learner it names. Any problem (bad, expired, unknown Learner) is the same `Unauthenticated`. */
export const authenticate = (token: string) =>
  Effect.gen(function* () {
    const signer = yield* TokenSigner
    const repo = yield* LearnerRepo
    const slug = yield* signer.verify(token)
    const found = yield* repo.findBySlug(slug)
    return yield* Option.match(found, {
      onNone: () => Effect.fail(new Unauthenticated()),
      onSome: Effect.succeed
    })
  }).pipe(Effect.catchTag("InvalidToken", () => Effect.fail(new Unauthenticated())))
