import { Effect, Option } from "effect"
import { CurrentLearner } from "@voca/contract"
import { LearnerNotFound } from "../domain/learner.ts"
import { LearnerRepo } from "./ports.ts"

/** `GET /me`: the signed-in Learner's record. */
export const getMe = Effect.gen(function* () {
  const { slug } = yield* CurrentLearner
  const repo = yield* LearnerRepo
  const found = yield* repo.findBySlug(slug)
  return yield* Option.match(found, {
    onNone: () => Effect.fail(new LearnerNotFound()),
    onSome: Effect.succeed
  })
})
