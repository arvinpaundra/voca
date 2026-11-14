import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { NotFound } from "./errors.ts"
import { Count, Drill, Instant, Maturity, Month, NonNegative, Rating, Ratio, StudyDate } from "./primitives.ts"
import { Word } from "./library.ts"
import { DeckSlug, WordSlug } from "./slug.ts"

// ───── Word stats (10-analytics) ─────

const NullableRatio = Schema.NullOr(Ratio)

/** Metrics for one Card = one (word, drill). */
export const WordDrillStats = Schema.Struct({
  drill: Drill,
  label: Schema.String,
  maturity: Maturity,
  recallNow: NullableRatio,
  stabilityDays: Schema.NullOr(NonNegative),
  difficulty: Schema.NullOr(Schema.Finite.check(Schema.isBetween({ minimum: 1, maximum: 10 }))),
  reps: Count,
  lapses: Count,
  leech: Schema.Boolean,
  isHard: Schema.Boolean,
  accuracy: Schema.Struct({ overall: NullableRatio, last10: NullableRatio, easy: NullableRatio, hard: NullableRatio }),
  streak: Count,
  medianLatencyMs: Schema.NullOr(Count),
  attemptsToCorrect: Schema.NullOr(NonNegative),
  nextDue: Schema.NullOr(Instant),
  intervalDays: Schema.NullOr(Count),
  firstSeen: Schema.NullOr(Instant),
  lastReviewed: Schema.NullOr(Instant),
  confusedWith: Schema.Array(Schema.Struct({ wordSlug: WordSlug, term: Schema.String, count: Count })), // top 3
  history: Schema.Array(Schema.Struct({ // last 50 first attempts
    at: Instant,
    correct: Schema.Boolean,
    rating: Rating,
    latencyMs: Count,
    predictedRecall: NullableRatio,
    intervalDays: Count
  }))
})
export type WordDrillStats = typeof WordDrillStats.Type

/** One entry per drill the word has a Card in. */
export const WordStats = Schema.Struct({ word: Word, drills: Schema.Array(WordDrillStats) })
export type WordStats = typeof WordStats.Type

// ───── Deck stats ─────

const DayCount = Schema.Struct({ date: StudyDate, count: Count })

export const DeckStats = Schema.Struct({
  maturity: Schema.Struct({ new: Count, learning: Count, mature: Count }),
  dueToday: Count,
  overdue: Count,
  forecast: Schema.Array(DayCount), // the next 7 study days
  trueRetention: NullableRatio, // last 30 days, reviews of non-new cards
  calibration: Schema.NullOr(Schema.Struct({ predicted: Ratio, actual: Ratio })), // last 30 days
  reviewsPerDay: Schema.Array(DayCount) // last 30 days
})
export type DeckStats = typeof DeckStats.Type

// ───── Notifications ─────

export const Notifications = Schema.Struct({
  decks: Schema.Array(Schema.Struct({
    deckSlug: DeckSlug,
    title: Schema.String,
    due: Count,
    overdue: Count,
    byDrill: Schema.Array(Schema.Struct({ drill: Drill, label: Schema.String, due: Count }))
  })),
  hardDue: Count,
  newAvailable: Count
})
export type Notifications = typeof Notifications.Type

// ───── Activity heatmap ─────

export const Activity = Schema.Struct({
  month: Month,
  days: Schema.Array(Schema.Struct({ date: StudyDate, reviews: Count })) // only days with reviews
})
export type Activity = typeof Activity.Type

// ───── Endpoints ─────

export class InsightGroup extends HttpApiGroup.make("insight").add(
  HttpApiEndpoint.get("wordStats", "/words/:wordSlug/stats", { params: { wordSlug: WordSlug }, success: WordStats, error: NotFound }),
  HttpApiEndpoint.get("deckStats", "/decks/:deckSlug/stats", { params: { deckSlug: DeckSlug }, success: DeckStats, error: NotFound }),
  HttpApiEndpoint.get("notifications", "/notifications", { success: Notifications }),
  /** Default month: the current study month. A future month returns `days: []`. */
  HttpApiEndpoint.get("activity", "/me/activity", { query: { month: Schema.optionalKey(Month) }, success: Activity })
) {}
