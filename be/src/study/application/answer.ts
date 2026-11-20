import { DateTime, Effect, Option } from "effect"
import { CurrentLearner } from "@voca/contract"
import type { AnswerResult, Answer, Question } from "@voca/contract"
import {
  DeckTooSmallError,
  QuestionAlreadyAnswered,
  QuestionNotFound,
  SessionNotActive,
  SessionNotFound
} from "../domain/errors.ts"
import {
  fuzzInterval,
  initialMemory,
  intervalDays,
  nextMemory,
  ratingFromAnswer,
  retrievability,
  type Rating
} from "../domain/fsrs.ts"
import { questionOf } from "../domain/questions.ts"
import { pickOptions } from "../domain/selection.ts"
import { dueAfter, studyDay } from "../domain/studyDay.ts"
import type { StudyWord } from "../domain/words.ts"
import { Transaction } from "../../shared/transaction.ts"
import { StudyRepo, type CardState, type QuestionRecord, type SessionRecord, type StudySettings } from "./studyRepo.ts"
import { loadWords, requireOwnedSession, requireQuestion, wordAt } from "./lookups.ts"

type Needs = CurrentLearner | StudyRepo | Transaction

const LEECH_LAPSES = 4
const MS_PER_DAY = 86_400_000

/** A card's memory after the answer, or its first memory, with the review facts the history keeps. */
const nextState = (previous: CardState | null, rating: Rating, now: DateTime.Utc) => {
  if (previous === null) {
    return {
      memory: initialMemory(rating),
      state: "new" as const,
      elapsedDays: null,
      retrievability: null
    }
  }

  const elapsedDays = (DateTime.toEpochMillis(now) - DateTime.toEpochMillis(previous.lastReview)) / MS_PER_DAY

  return {
    memory: nextMemory(previous, elapsedDays, rating),
    state: "review" as const,
    elapsedDays,
    retrievability: retrievability(elapsedDays, previous.stability)
  }
}

/** The first answer to a question moves its card: rating, memory, due date and review history. Returns the due date. */
const scheduleFirstAnswer = (input: {
  readonly learnerId: bigint
  readonly session: SessionRecord
  readonly question: QuestionRecord
  readonly correct: boolean
  readonly latencyMs: number
  readonly chosenWordId: bigint | null
  readonly now: DateTime.Utc
  readonly settings: StudySettings
}): Effect.Effect<DateTime.Utc, never, StudyRepo> =>
  Effect.gen(function* () {
    const repo = yield* StudyRepo
    const { learnerId, session, question, now, settings } = input
    const previous = Option.getOrNull(yield* repo.findCard(learnerId, question.wordId, question.drill))
    const rating = ratingFromAnswer(input.correct, input.latencyMs)
    const outcome = nextState(previous, rating, now)
    const reps = previous === null ? 1 : previous.reps + 1
    const lapses = previous === null ? 0 : previous.lapses + (rating === 1 ? 1 : 0)
    // The seed is the card's identity and its repetition count, so the same card always gets the same fuzz.
    const scheduledDays = fuzzInterval(
      intervalDays(outcome.memory.stability, settings.desiredRetention),
      `${question.wordId}:${question.drill}:${reps}`
    )
    const day = studyDay(now, settings.timezone, settings.dayStartHour)
    const due = dueAfter(day, settings.timezone, settings.dayStartHour, scheduledDays)

    yield* repo.saveCard(learnerId, question.wordId, question.drill, {
      stability: outcome.memory.stability,
      difficulty: outcome.memory.difficulty,
      due,
      lastReview: now,
      reps,
      lapses
    })
    yield* repo.insertReview(learnerId, {
      wordId: question.wordId,
      drill: question.drill,
      sessionId: session.id,
      reviewedAt: now,
      rating,
      correct: input.correct,
      mode: session.mode,
      latencyMs: input.latencyMs,
      chosenWordId: input.chosenWordId,
      stateBefore: outcome.state,
      elapsedDays: outcome.elapsedDays,
      retrievability: outcome.retrievability,
      stabilityBefore: previous?.stability ?? null,
      difficultyBefore: previous?.difficulty ?? null,
      stabilityAfter: outcome.memory.stability,
      difficultyAfter: outcome.memory.difficulty,
      scheduledDays
    })

    return due
  })

/**
 * The same word again with fresh options, after a wrong answer. Retries don't reschedule. When the deck has shrunk too
 * far for fresh options, the question keeps the ones it had.
 */
const askAgain = (input: {
  readonly session: SessionRecord
  readonly question: QuestionRecord
  readonly prompt: StudyWord
  readonly previousOptions: ReadonlyArray<StudyWord>
}): Effect.Effect<Question, never, StudyRepo> =>
  Effect.gen(function* () {
    const repo = yield* StudyRepo
    const { session, question, prompt } = input
    // The options come from the word's own deck, which is the session's deck for a deck session.
    const deck = yield* repo.deckOfWord(question.wordId)
    const words = yield* repo.deckWords(deck.id)
    const options = yield* pickOptions(words, question.drill, prompt, session.mode).pipe(
      Effect.catchTag("DeckTooSmallError", () => Effect.succeed(input.previousOptions))
    )
    const position = (yield* repo.maxPosition(session.id)) + 1
    const attempt = question.attempt + 1

    yield* repo.insertQuestion(session.id, {
      position,
      attempt,
      wordId: question.wordId,
      drill: question.drill,
      optionIds: options.map((option) => option.id)
    })

    return questionOf({
      position,
      attempt,
      drill: question.drill,
      word: prompt,
      options,
      termLang: deck.termLang
    })
  })

/**
 * Records the Learner's answer to one question. A wrong answer adds a retry. When no question is left pending, the
 * session completes.
 */
export const answerQuestion = (
  sessionSlug: string,
  input: typeof Answer.Type
): Effect.Effect<
  AnswerResult,
  SessionNotFound | QuestionNotFound | QuestionAlreadyAnswered | SessionNotActive,
  Needs
> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* StudyRepo
    const transaction = yield* Transaction
    const now = yield* DateTime.now
    const settings = yield* repo.learnerSettings(learnerId)

    return yield* transaction.run(
      Effect.gen(function* () {
        const session = yield* requireOwnedSession(learnerId, sessionSlug)

        if (session.status !== "active") {
          return yield* Effect.fail(new SessionNotActive())
        }

        const question = yield* requireQuestion(session.id, input.position)

        if (question.answered) {
          return yield* Effect.fail(new QuestionAlreadyAnswered())
        }

        const words = yield* loadWords([question.wordId, ...question.optionIds])
        const prompt = yield* wordAt(words, question.wordId)
        const options = yield* Effect.forEach(question.optionIds, (id) => wordAt(words, id))
        const correct = input.chosenWordSlug === prompt.slug
        const chosenWordId = options.find((option) => option.slug === input.chosenWordSlug)?.id ?? null

        yield* repo.recordAnswer(question.id, { at: now, chosenWordId, correct, latencyMs: input.latencyMs })

        let nextDue: DateTime.Utc | null = null

        if (question.attempt === 1) {
          nextDue = yield* scheduleFirstAnswer({
            learnerId,
            session,
            question,
            correct,
            latencyMs: input.latencyMs,
            chosenWordId,
            now,
            settings
          })
        }

        const card = Option.getOrNull(yield* repo.findCard(learnerId, question.wordId, question.drill))
        const leech = (card?.lapses ?? 0) >= LEECH_LAPSES

        const retry = correct
          ? null
          : yield* askAgain({ session, question, prompt, previousOptions: options })

        const pending = yield* repo.pendingQuestions(session.id)
        const completed = pending.length === 0

        if (completed) {
          yield* repo.setSessionStatus(session.id, "completed", now)
        }

        return {
          correct,
          correctWordSlug: prompt.slug,
          nextDue,
          retry,
          completed,
          leech,
          reading: "not implemented: BS"
        } satisfies AnswerResult
      })
    )
  })
