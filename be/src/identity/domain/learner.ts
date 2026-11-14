import { Data, Schema } from "effect"
import type { Learner } from "@voca/contract"
import type { UpdateSettings } from "@voca/contract"
import { LearnerSettings, LearnerSlug } from "@voca/contract"

/**
 * A signed-up Learner as the server holds it. `id` is the internal bigint: it never leaves the server.
 * Built from the contract's Schemas, so a row that breaks an invariant fails to decode instead of being served.
 */
export const LearnerRecord = Schema.Struct({
  id: Schema.BigInt,
  slug: LearnerSlug,
  email: Schema.String,
  name: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtc,
  settings: LearnerSettings
})
export type LearnerRecord = typeof LearnerRecord.Type

/** The wire shape (`GET /me`): the record without its internal id. */
export const toLearner = (record: LearnerRecord): typeof Learner.Type => ({
  slug: record.slug,
  email: record.email,
  name: record.name,
  avatarUrl: record.avatarUrl,
  createdAt: record.createdAt,
  settings: record.settings
})

/** Each key present in the patch replaces the old value; absent keys stay as they were. */
export const applySettingsPatch = (settings: LearnerSettings, patch: typeof UpdateSettings.Type): LearnerSettings => ({
  ...settings,
  ...patch
})

export class LearnerNotFound extends Data.TaggedError("LearnerNotFound")<{}> {}
