import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { DeckTooSmall, DrillNotAvailable, NothingToStudy, NotFound, QuestionAlreadyAnswered, SessionNotActive } from "./errors.ts"
import { Count, DeckTitle, Drill, Instant, LangTag, Mode, Page, PageQuery, Reading, SessionSize } from "./primitives.ts"
import { DeckDrill, WordWithCards } from "./library.ts"
import { DeckSlug, SessionSlug, WordSlug } from "./slug.ts"

// ───── Schemas ─────

export const SessionScope = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("deck"), deckSlug: DeckSlug }),
  Schema.Struct({ kind: Schema.Literal("hard") }) // the Hard Words place
])
export type SessionScope = typeof SessionScope.Type

/** 1–4 distinct drills; a session may mix them. */
export const DrillSet = Schema.NonEmptyArray(Drill).check(Schema.isMaxLength(4), Schema.isUnique())

export const StartSession = Schema.Struct({ scope: SessionScope, drills: DrillSet, size: SessionSize, mode: Mode })

export const OPTIONS_PER_QUESTION = 4

export const Question = Schema.Struct({
  position: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  attempt: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)), // ≥ 2 ⇒ a retry of a wrong answer
  wordSlug: WordSlug,
  drill: Drill, // per question: sessions can mix drills
  drillLabel: Schema.String, // e.g. "Word → Hiragana"
  prompt: Schema.Struct({
    text: Schema.String,
    // Always null: a question never hints the reading (FR-17). Kept until the frontend stops reading it.
    ruby: Schema.NullOr(Schema.String)
  }),
  options: Schema.Array(Schema.Struct({ wordSlug: WordSlug, text: Schema.String })).check(
    Schema.isMinLength(OPTIONS_PER_QUESTION),
    Schema.isMaxLength(OPTIONS_PER_QUESTION)
  )
})
export type Question = typeof Question.Type

export const SessionStatus = Schema.Literals(["active", "completed", "abandoned"])

export const Session = Schema.Struct({
  slug: SessionSlug,
  drills: DrillSet,
  termLang: LangTag,
  mode: Mode,
  // The words actually picked. Fewer than the requested size when not enough were due or new.
  size: Count,
  status: SessionStatus,
  cleared: Count, // progress = cleared / size
  questions: Schema.Array(Question) // pending only, in position order
})
export type Session = typeof Session.Type

export const MAX_LATENCY_MS = 10 * 60 * 1000

export const Answer = Schema.Struct({
  position: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  chosenWordSlug: WordSlug,
  latencyMs: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: MAX_LATENCY_MS }))
})

export const AnswerResult = Schema.Struct({
  correct: Schema.Boolean,
  correctWordSlug: WordSlug,
  nextDue: Schema.NullOr(Instant), // set on attempt 1 only: retries don't reschedule
  retry: Schema.NullOr(Question), // the same word again, new options, when wrong
  completed: Schema.Boolean,
  leech: Schema.Boolean, // suggest adding to Hard Words
  // The answered word's reading, for the feedback; null when it has none. Optional only while the server rolls out.
  reading: Schema.optionalKey(Schema.NullOr(Reading))
})
export type AnswerResult = typeof AnswerResult.Type

// ───── Endpoints ─────

const deckParams = { deckSlug: DeckSlug }
const sessionParams = { sessionSlug: SessionSlug }
/**
 * A word with at least one hard Card, and the deck it lives in (the Hard Words list spans decks).
 * `deck` is optional only while the server rolls out; it is always sent once hard words ship.
 */
export const HardWord = Schema.Struct({
  ...WordWithCards.fields,
  deck: Schema.optionalKey(Schema.Struct({ slug: DeckSlug, title: DeckTitle, termLang: LangTag, meaningLang: LangTag }))
})
export type HardWord = typeof HardWord.Type

const cardParams = { wordSlug: WordSlug, drill: Drill }

export class StudyGroup extends HttpApiGroup.make("study").add(
  /** Only drills that apply to at least one word of the deck, each with today's due and new counts. */
  HttpApiEndpoint.get("deckDrills", "/decks/:deckSlug/drills", {
    params: deckParams,
    success: Schema.Array(DeckDrill),
    error: NotFound
  }),
  /** Abandons any active session first (one active session per Learner). A session always holds at least one word. */
  HttpApiEndpoint.post("start", "/sessions", {
    payload: StartSession,
    success: Session,
    error: [NotFound, DeckTooSmall, DrillNotAvailable, NothingToStudy]
  }),
  HttpApiEndpoint.get("active", "/sessions/active", { success: Schema.NullOr(Session) }),
  HttpApiEndpoint.post("answer", "/sessions/:sessionSlug/answers", {
    params: sessionParams,
    payload: Answer,
    success: AnswerResult,
    error: [NotFound, QuestionAlreadyAnswered, SessionNotActive]
  }),
  HttpApiEndpoint.post("abandon", "/sessions/:sessionSlug/abandon", { params: sessionParams, error: NotFound }),
  HttpApiEndpoint.get("hardWords", "/hard-words", {
    query: { drill: Schema.optionalKey(Drill), ...PageQuery },
    success: Page(HardWord)
  }),
  /** NotFound when the word has no Card in that drill yet (never studied there). */
  HttpApiEndpoint.put("markHard", "/words/:wordSlug/drills/:drill/hard", { params: cardParams, error: NotFound }),
  HttpApiEndpoint.delete("unmarkHard", "/words/:wordSlug/drills/:drill/hard", { params: cardParams, error: NotFound })
) {}
