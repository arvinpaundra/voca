import { Effect, Random } from "effect"
import { slug } from "@voca/contract"

/** A new public id, drawn from Effect's `Random` so a test can seed it. */
export const newSlug = (length: number): Effect.Effect<string> =>
  Effect.gen(function* () {
    const bytes = yield* Effect.forEach(Array.from({ length }), () => Random.nextIntBetween(0, 256))

    return slug(Uint8Array.from(bytes))
  })
