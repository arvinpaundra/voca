import type { DateTime, Effect, Option } from "effect"
import { Context } from "effect"
import type { DeckSlug, Drill, Mode, Rating, Word, WordSlug } from "@voca/contract"

/** Whose data a read model counts: one deck of the Learner, or every live deck of the Learner when `deckId` is null. */
export interface Scope {
  readonly learnerId: bigint
  readonly deckId: bigint | null
}

/** The timezone and day start hour that decide which study day a review or a due date falls on. */
export interface Clock {
  readonly timezone: string
  readonly dayStartHour: number
}

export interface LearnerSettings extends Clock {
  readonly newPerDay: number
}

/** A study date, `YYYY-MM-DD`, with a count. */
export interface DayCount {
  readonly date: string
  readonly count: number
}

/** The due cards of one drill in one live deck, with the deck's title and language for the labels. */
export interface DeckDue {
  readonly deckSlug: DeckSlug
  readonly title: string
  readonly termLang: string
  readonly drill: Drill
  readonly due: number
  readonly overdue: number
  readonly hard: number
}

/** The Learner's live word with the language of its deck. */
export interface OwnedWord {
  readonly id: bigint
  readonly termLang: string
  readonly word: Word
}

/** The Learner's live Card of one drill. */
export interface WordCardRow {
  readonly drill: Drill
  readonly stability: number
  readonly difficulty: number
  readonly due: DateTime.Utc
  readonly lastReview: DateTime.Utc
  readonly reps: number
  readonly lapses: number
  readonly isHard: boolean
}

/** One first attempt of a word. */
export interface WordReviewRow {
  readonly drill: Drill
  readonly reviewedAt: DateTime.Utc
  readonly rating: Rating
  readonly correct: boolean
  readonly mode: Mode
  readonly latencyMs: number
  readonly predictedRecall: number | null
  readonly scheduledDays: number
}

/** One answered attempt of a word inside a session. */
export interface WordAttemptRow {
  readonly sessionId: bigint
  readonly drill: Drill
  readonly correct: boolean
  readonly chosenWordId: bigint | null
}

/** A word picked by mistake, with what the word page shows of it. */
export interface PickedWord {
  readonly id: bigint
  readonly slug: WordSlug
  readonly term: string
}

/** Read models over the Learner's study data. Reads only; infrastructure failures are defects. */
export class InsightRepo extends Context.Service<InsightRepo, {
  learnerSettings(learnerId: bigint): Effect.Effect<LearnerSettings>
  /** The id of the Learner's live deck with this slug. */
  findLiveDeck(learnerId: bigint, deckSlug: string): Effect.Effect<Option.Option<bigint>>
  /** Live cards by stability: learning below `matureDays`, mature from it. */
  cardMaturity(scope: Scope, matureDays: number): Effect.Effect<{ readonly learning: number; readonly mature: number }>
  /**
   * Studyable (word, drill) pairs of live words that have no live card of the Learner yet. With `awakeAt`, the decks
   * whose snooze is live at that instant are left out.
   */
  unstudiedPairs(scope: Scope, awakeAt?: DateTime.Utc): Effect.Effect<number>
  /** Live cards due before `end`, and of those the ones due before `start`. */
  dueCounts(
    scope: Scope,
    start: DateTime.Utc,
    end: DateTime.Utc
  ): Effect.Effect<{ readonly due: number; readonly overdue: number }>
  /** Live cards due per study date, for the study dates from `from` to `to` inclusive. */
  dueForecast(scope: Scope, clock: Clock, from: string, to: string): Effect.Effect<ReadonlyArray<DayCount>>
  /** Review-state first attempts per study date from `from` to `to` inclusive: how many, how many correct, mean predicted recall. */
  reviewStats(
    scope: Scope,
    clock: Clock,
    from: string,
    to: string
  ): Effect.Effect<{ readonly total: number; readonly correct: number; readonly predicted: number | null }>
  /** Reviews per study date, any state, up to `to` inclusive, ascending. Only dates with reviews. */
  reviewDays(scope: Scope, clock: Clock, to: string): Effect.Effect<ReadonlyArray<DayCount>>
  /** First attempts of words in state 'new' in [from, to). */
  newReviewsBetween(learnerId: bigint, from: DateTime.Utc, to: DateTime.Utc): Effect.Effect<number>
  /** The Learner's live word with this slug. */
  findOwnedWord(learnerId: bigint, wordSlug: string): Effect.Effect<Option.Option<OwnedWord>>
  /** The Learner's live cards of the word, one per drill. */
  wordCards(learnerId: bigint, wordId: bigint): Effect.Effect<ReadonlyArray<WordCardRow>>
  /** The Learner's first attempts of the word in every drill, newest first. */
  wordReviews(learnerId: bigint, wordId: bigint): Effect.Effect<ReadonlyArray<WordReviewRow>>
  /** The Learner's answered session attempts of the word: newest session first, then in answer order. */
  wordAttempts(learnerId: bigint, wordId: bigint): Effect.Effect<ReadonlyArray<WordAttemptRow>>
  /** The words with these ids, for naming the ones the Learner picked by mistake. */
  pickedWords(ids: ReadonlyArray<bigint>): Effect.Effect<ReadonlyArray<PickedWord>>
  /** The Learner's due cards per live deck and drill, due before `end`, leaving out the decks whose snooze is live at `now`. */
  dueByDeck(
    learnerId: bigint,
    start: DateTime.Utc,
    end: DateTime.Utc,
    now: DateTime.Utc
  ): Effect.Effect<ReadonlyArray<DeckDue>>
  /** Seconds per first attempt in each of the Learner's latest 20 sessions with more than one first attempt, newest first. */
  sessionPaces(learnerId: bigint): Effect.Effect<ReadonlyArray<number>>
}>()("voca/insight/InsightRepo") {}
