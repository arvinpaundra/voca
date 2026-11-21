import type { DateTime, Effect, Option } from "effect"
import { Context } from "effect"
import type { Drill, DrillSet, HardWord, LangTag, Mode, SessionSlug } from "@voca/contract"
import type { StudyWord } from "../domain/words.ts"

/** A hard Card of the Learner, with the deck of its word: the pool its session question draws options from. */
export interface HardCard {
  readonly wordId: bigint
  readonly drill: Drill
  readonly due: DateTime.Utc
  readonly deckId: bigint
  readonly termLang: LangTag
}

/** `drill` filters the words to those with a hard card in it; `cursor` continues after the last word of a page. */
export interface HardWordQuery {
  readonly drill: Drill | null
  readonly cursor: string | null
  readonly limit: number
}

export interface HardWordPage {
  readonly items: ReadonlyArray<HardWord>
  readonly nextCursor: string | null
}

/** The 1–4 drills of a session, as the contract states them. */
export type Drills = typeof DrillSet.Type

export interface StudySettings {
  readonly timezone: string
  readonly dayStartHour: number
  readonly desiredRetention: number
  readonly newPerDay: number
}

export interface OwnedDeck {
  readonly id: bigint
  readonly termLang: LangTag
}

/** A live card of the Learner in one deck: enough to tell which drills are due and which words are new. */
export interface DeckCard {
  readonly wordId: bigint
  readonly drill: Drill
  readonly due: DateTime.Utc
}

export interface CardState {
  readonly stability: number
  readonly difficulty: number
  readonly lastReview: DateTime.Utc
  readonly reps: number
  readonly lapses: number
}

export interface CardWrite {
  readonly stability: number
  readonly difficulty: number
  readonly due: DateTime.Utc
  readonly lastReview: DateTime.Utc
  readonly reps: number
  readonly lapses: number
}

export interface ReviewWrite {
  readonly wordId: bigint
  readonly drill: Drill
  readonly sessionId: bigint
  readonly reviewedAt: DateTime.Utc
  readonly rating: number
  readonly correct: boolean
  readonly mode: Mode
  readonly latencyMs: number
  readonly chosenWordId: bigint | null
  readonly stateBefore: "new" | "review"
  readonly elapsedDays: number | null
  readonly retrievability: number | null
  readonly stabilityBefore: number | null
  readonly difficultyBefore: number | null
  readonly stabilityAfter: number
  readonly difficultyAfter: number
  readonly scheduledDays: number
}

export interface SessionRecord {
  readonly id: bigint
  readonly slug: SessionSlug
  /** Null for a hard session, which spans decks. */
  readonly deckId: bigint | null
  /** Null for a hard session: its questions carry their own language. */
  readonly termLang: LangTag | null
  readonly drills: Drills
  readonly mode: Mode
  readonly size: number
  readonly status: "active" | "completed" | "abandoned"
}

export interface NewSession {
  readonly slug: SessionSlug
  readonly deckId: bigint | null
  readonly drills: Drills
  readonly mode: Mode
  readonly size: number
  readonly createdAt: DateTime.Utc
}

export interface NewQuestion {
  readonly position: number
  readonly attempt: number
  readonly wordId: bigint
  readonly drill: Drill
  readonly optionIds: ReadonlyArray<bigint>
}

export interface QuestionRecord {
  readonly id: bigint
  readonly wordId: bigint
  readonly drill: Drill
  readonly attempt: number
  readonly optionIds: ReadonlyArray<bigint>
  readonly answered: boolean
}

/** A question still to answer, in the shape the session view needs. */
export interface PendingQuestion {
  readonly position: number
  readonly attempt: number
  readonly drill: Drill
  readonly wordId: bigint
  readonly optionIds: ReadonlyArray<bigint>
  readonly termLang: LangTag
}

export interface AnswerRecord {
  readonly at: DateTime.Utc
  readonly chosenWordId: bigint | null
  readonly correct: boolean
  readonly latencyMs: number
}

/** Study data, always scoped to one Learner or one deck. Infrastructure failures are defects. */
export class StudyRepo extends Context.Service<StudyRepo, {
  learnerSettings(learnerId: bigint): Effect.Effect<StudySettings>
  /** The deck when the Learner owns it and it isn't deleted. */
  findOwnedDeck(learnerId: bigint, deckSlug: string): Effect.Effect<Option.Option<OwnedDeck>>
  /** The live words of a deck, oldest first. */
  deckWords(deckId: bigint): Effect.Effect<ReadonlyArray<StudyWord>>
  /** The Learner's live cards for the words of a deck. */
  deckCards(learnerId: bigint, deckId: bigint): Effect.Effect<ReadonlyArray<DeckCard>>
  /** Reviews of a word for the first time (state 'new') in [from, to). */
  newReviewsBetween(learnerId: bigint, from: DateTime.Utc, to: DateTime.Utc): Effect.Effect<number>
  findCard(learnerId: bigint, wordId: bigint, drill: Drill): Effect.Effect<Option.Option<CardState>>
  /** Creates the Learner's card for this word and drill, or replaces its scheduling. */
  saveCard(learnerId: bigint, wordId: bigint, drill: Drill, card: CardWrite): Effect.Effect<void>
  insertReview(learnerId: bigint, review: ReviewWrite): Effect.Effect<void>
  /** The Learner's hard cards in these drills, of live words in live decks they own that aren't snoozed at `now`. */
  hardCards(learnerId: bigint, drills: ReadonlyArray<Drill>, now: DateTime.Utc): Effect.Effect<ReadonlyArray<HardCard>>
  /** The Learner's hard words, keyset-paged; each carries its hard cards and its deck. Snoozed decks at `now` are out. */
  hardWords(learnerId: bigint, query: HardWordQuery, now: DateTime.Utc): Effect.Effect<HardWordPage>
  /** Sets or clears the hard flag of the Learner's card; false when there is no such card. */
  setHard(learnerId: bigint, wordSlug: string, drill: Drill, isHard: boolean): Effect.Effect<boolean>
  /** The deck a word lives in, deleted or not: a question keeps the pool it was asked from. */
  deckOfWord(wordId: bigint): Effect.Effect<OwnedDeck>
  /** The Learner's active session, at most one. */
  findActiveSession(learnerId: bigint): Effect.Effect<Option.Option<SessionRecord>>
  /** The Learner's session with this slug, locked until the surrounding `Transaction` ends. */
  lockOwnedSession(learnerId: bigint, sessionSlug: string): Effect.Effect<Option.Option<SessionRecord>>
  setSessionStatus(sessionId: bigint, status: "completed" | "abandoned", at: DateTime.Utc): Effect.Effect<void>
  insertSession(learnerId: bigint, session: NewSession): Effect.Effect<bigint>
  insertQuestion(sessionId: bigint, question: NewQuestion): Effect.Effect<void>
  /** The question at a position, locked until the surrounding `Transaction` ends. */
  lockQuestion(sessionId: bigint, position: number): Effect.Effect<Option.Option<QuestionRecord>>
  recordAnswer(questionId: bigint, answer: AnswerRecord): Effect.Effect<void>
  /** Unanswered questions of a session, in position order. */
  pendingQuestions(sessionId: bigint): Effect.Effect<ReadonlyArray<PendingQuestion>>
  /** The highest position used in a session, 0 when it has none. */
  maxPosition(sessionId: bigint): Effect.Effect<number>
  /** Distinct words answered correctly in a session. */
  clearedCount(sessionId: bigint): Effect.Effect<number>
  /** Words by id, deleted ones included: a session keeps asking about a word deleted after it started. */
  wordsByIds(ids: ReadonlyArray<bigint>): Effect.Effect<ReadonlyArray<StudyWord>>
}>()("voca/study/StudyRepo") {}
