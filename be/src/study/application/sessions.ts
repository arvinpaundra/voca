import { DateTime, Effect, Option, Random, Schema } from "effect"
import { CurrentLearner, SLUG_LENGTH, SessionSlug, slug as slugOf } from "@voca/contract"
import type { Drill, LangTag, Session, SessionSize } from "@voca/contract"
import { DeckNotFound, DeckTooSmallError, DrillNotAvailableError, SessionNotFound } from "../domain/errors.ts"
import { questionOf } from "../domain/questions.ts"
import { cardKey, pickDue, pickHard, pickNew, pickOptions } from "../domain/selection.ts"
import { studyDay } from "../domain/studyDay.ts"
import { appliesTo, type StudyWord } from "../domain/words.ts"
import { Transaction } from "../../shared/transaction.ts"
import { StudyRepo, type Drills } from "./studyRepo.ts"
import { dueIndexOf, findOwnedDeck, loadWords, requireOwnedSession, wordAt } from "./lookups.ts"

type Needs = CurrentLearner | StudyRepo | Transaction

export interface StartRequest {
  readonly drills: Drills
  readonly size: SessionSize
}

/** A new public id for a session, drawn from Effect's `Random` so a test can seed it. */
const newSessionSlug: Effect.Effect<SessionSlug> = Effect.gen(function* () {
  const bytes = yield* Effect.forEach(Array.from({ length: SLUG_LENGTH.session }), () => Random.nextIntBetween(0, 256))

  return yield* Schema.decodeUnknownEffect(SessionSlug)(slugOf(Uint8Array.from(bytes))).pipe(Effect.orDie)
})

/**
 * Starts a session on a deck. Any active session of the Learner is abandoned first. Due words come first, then new
 * words up to today's limit. Everything is written in one transaction, so a refused start leaves the old session alone.
 */
export const startSession = (
  deckSlug: string,
  request: StartRequest
): Effect.Effect<Session, DeckNotFound | DeckTooSmallError | DrillNotAvailableError, Needs> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* StudyRepo
    const transaction = yield* Transaction
    const deck = yield* findOwnedDeck(learnerId, deckSlug)
    const settings = yield* repo.learnerSettings(learnerId)
    const now = yield* DateTime.now
    const day = studyDay(now, settings.timezone, settings.dayStartHour)
    const slug = yield* newSessionSlug

    return yield* transaction.run(
      Effect.gen(function* () {
        const active = yield* repo.findActiveSession(learnerId)

        if (Option.isSome(active)) {
          yield* repo.setSessionStatus(active.value.id, "abandoned", now)
        }

        const words = yield* repo.deckWords(deck.id)
        const usable = request.drills.some((drill) => words.some((word) => appliesTo(drill, word)))

        if (!usable) {
          return yield* Effect.fail(new DrillNotAvailableError())
        }

        const dueAt = dueIndexOf(yield* repo.deckCards(learnerId, deck.id))
        const dueBefore = DateTime.toEpochMillis(day.end)
        const due = pickDue({ words, dueAt, drills: request.drills, dueBefore, size: request.size })
        const newToday = yield* repo.newReviewsBetween(learnerId, day.start, day.end)
        const limit = Math.min(request.size - due.length, Math.max(0, settings.newPerDay - newToday))
        const fresh = pickNew({
          words,
          hasCard: (wordId, drill) => dueAt.has(cardKey(wordId, drill)),
          drills: request.drills,
          taken: new Set(due.map(({ pick }) => pick.word.id)),
          limit
        })

        // Shuffled, so the due words don't always come first on the screen.
        const picks = yield* Random.shuffle([...due.map(({ pick }) => pick), ...fresh])

        if (picks.length === 0) {
          return yield* Effect.die("not implemented: QUEUE")
        }
        const questions: Array<{
          readonly position: number
          readonly drill: Drill
          readonly word: StudyWord
          readonly options: ReadonlyArray<StudyWord>
        }> = []

        for (const [index, pick] of picks.entries()) {
          const options = yield* pickOptions(words, pick.drill, pick.word)

          questions.push({ position: index + 1, drill: pick.drill, word: pick.word, options })
        }

        // ponytail: Hard mode is out of scope, so every session runs as easy.
        const sessionId = yield* repo.insertSession(learnerId, {
          slug,
          deckId: deck.id,
          drills: request.drills,
          mode: "easy",
          // What was found, not what was asked for: the progress bar counts the words of this session.
          size: picks.length,
          createdAt: now
        })

        for (const question of questions) {
          yield* repo.insertQuestion(sessionId, {
            position: question.position,
            attempt: 1,
            wordId: question.word.id,
            drill: question.drill,
            optionIds: question.options.map((option) => option.id)
          })
        }

        return {
          slug,
          drills: request.drills,
          termLang: deck.termLang,
          mode: "easy",
          size: picks.length,
          status: "active",
          cleared: 0,
          questions: questions.map((question) =>
            questionOf({
              position: question.position,
              attempt: 1,
              drill: question.drill,
              word: question.word,
              options: question.options,
              termLang: deck.termLang
            })
          )
        } satisfies Session
      })
    )
  })

/**
 * Starts a session on the Learner's hard words, across decks. Each word is asked once, in the drill where its hard card
 * is most overdue; no new words. Each question's options come from its own deck, as deck sessions do.
 */
export const startHardSession = (
  request: StartRequest
): Effect.Effect<Session, DeckTooSmallError | DrillNotAvailableError, Needs> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* StudyRepo
    const transaction = yield* Transaction
    const settings = yield* repo.learnerSettings(learnerId)
    const now = yield* DateTime.now
    const day = studyDay(now, settings.timezone, settings.dayStartHour)
    const slug = yield* newSessionSlug

    return yield* transaction.run(
      Effect.gen(function* () {
        const active = yield* repo.findActiveSession(learnerId)

        if (Option.isSome(active)) {
          yield* repo.setSessionStatus(active.value.id, "abandoned", now)
        }

        const cards = yield* repo.hardCards(learnerId, request.drills)

        if (cards.length === 0) {
          return yield* Effect.fail(new DrillNotAvailableError())
        }

        const picks = pickHard({
          cards: cards.map((card) => ({ ...card, due: DateTime.toEpochMillis(card.due) })),
          dueBefore: DateTime.toEpochMillis(day.end),
          size: request.size
        })

        const decks = yield* Effect.forEach([...new Set(picks.map((pick) => pick.deckId))], (deckId) =>
          repo.deckWords(deckId).pipe(Effect.map((words) => [deckId, words] as const))
        )
        const wordsByDeck = new Map(decks)

        // Shuffled, so the due words don't always come first on the screen.
        const ordered = yield* Random.shuffle(picks)
        const questions: Array<{
          readonly position: number
          readonly drill: Drill
          readonly word: StudyWord
          readonly options: ReadonlyArray<StudyWord>
          readonly termLang: LangTag
        }> = []

        for (const [index, pick] of ordered.entries()) {
          const words = yield* Effect.fromNullishOr(wordsByDeck.get(pick.deckId)).pipe(Effect.orDie)
          const word = yield* Effect.fromNullishOr(words.find((candidate) => candidate.id === pick.wordId)).pipe(
            Effect.orDie
          )
          const options = yield* pickOptions(words, pick.drill, word)

          questions.push({
            position: index + 1,
            drill: pick.drill,
            word,
            options,
            termLang: pick.termLang
          })
        }

        // A hard session spans decks, so it has no deck of its own.
        const sessionId = yield* repo.insertSession(learnerId, {
          slug,
          deckId: null,
          drills: request.drills,
          mode: "easy",
          size: ordered.length,
          createdAt: now
        })

        for (const question of questions) {
          yield* repo.insertQuestion(sessionId, {
            position: question.position,
            attempt: 1,
            wordId: question.word.id,
            drill: question.drill,
            optionIds: question.options.map((option) => option.id)
          })
        }

        const lead = yield* Effect.fromNullishOr(questions.at(0)).pipe(Effect.orDie)

        return {
          slug,
          drills: request.drills,
          termLang: lead.termLang,
          mode: "easy",
          size: ordered.length,
          status: "active",
          cleared: 0,
          questions: questions.map((question) =>
            questionOf({
              position: question.position,
              attempt: 1,
              drill: question.drill,
              word: question.word,
              options: question.options,
              termLang: question.termLang
            })
          )
        } satisfies Session
      })
    )
  })

/** The Learner's active session with its pending questions in position order, or null. */
export const activeSession = (): Effect.Effect<Session | null, never, Needs> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* StudyRepo
    const active = yield* repo.findActiveSession(learnerId)

    if (Option.isNone(active)) {
      return null
    }

    const session = active.value
    const pending = yield* repo.pendingQuestions(session.id)
    // A hard session has no deck language; its first pending question carries the session's.
    const termLang = session.termLang ?? pending.at(0)?.termLang

    if (termLang === undefined) {
      return yield* Effect.die("an active session has no pending question")
    }

    const words = yield* loadWords(pending.flatMap((question) => [question.wordId, ...question.optionIds]))
    const cleared = yield* repo.clearedCount(session.id)
    const questions = yield* Effect.forEach(pending, (question) =>
      Effect.gen(function* () {
        const word = yield* wordAt(words, question.wordId)
        const options = yield* Effect.forEach(question.optionIds, (id) => wordAt(words, id))

        return questionOf({
          position: question.position,
          attempt: question.attempt,
          drill: question.drill,
          word,
          options,
          termLang: question.termLang
        })
      })
    )

    return {
      slug: session.slug,
      drills: session.drills,
      termLang,
      mode: session.mode,
      size: session.size,
      status: session.status,
      cleared,
      questions
    } satisfies Session
  })

/** Ends the session. Ending one that already ended changes nothing. */
export const abandonSession = (sessionSlug: string): Effect.Effect<void, SessionNotFound, Needs> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* StudyRepo
    const transaction = yield* Transaction
    const now = yield* DateTime.now

    yield* transaction.run(
      Effect.gen(function* () {
        const session = yield* requireOwnedSession(learnerId, sessionSlug)

        if (session.status === "active") {
          yield* repo.setSessionStatus(session.id, "abandoned", now)
        }
      })
    )
  })
