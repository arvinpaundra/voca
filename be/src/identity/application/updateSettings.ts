import { Effect, Option } from "effect"
import { CurrentLearner } from "@voca/contract"
import type { UpdateSettings } from "@voca/contract"
import { applySettingsPatch, LearnerNotFound } from "../domain/learner.ts"
import { LearnerRepo } from "./ports.ts"

/** `PATCH /me/settings`: patch the signed-in Learner's settings and answer with the whole record. */
export const updateSettings = (patch: typeof UpdateSettings.Type) =>
  Effect.gen(function* () {
    const { slug } = yield* CurrentLearner
    const repo = yield* LearnerRepo
    const found = yield* repo.findBySlug(slug)
    const current = yield* Option.match(found, {
      onNone: () => Effect.fail(new LearnerNotFound()),
      onSome: Effect.succeed
    })
    const settings = applySettingsPatch(current.settings, patch)
    yield* repo.saveSettings(current.id, settings)
    return { ...current, settings }
  })
