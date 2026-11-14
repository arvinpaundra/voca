import { DateTime, Effect, Option } from "effect"
import { DeckNotFound, QuestionNotFound, SessionNotFound } from "../domain/errors.ts"
import type { StudyWord } from "../domain/words.ts"
import { cardKey } from "../domain/selection.ts"
import { StudyRepo, type DeckCard, type OwnedDeck, type QuestionRecord, type SessionRecord } from "./studyRepo.ts"

/** The deck of the Learner, or `DeckNotFound`. */
export const findOwnedDeck = (learnerId: bigint, deckSlug: string): Effect.Effect<OwnedDeck, DeckNotFound, StudyRepo> =>
  Effect.gen(function* () {
    const repo = yield* StudyRepo
    const found = yield* repo.findOwnedDeck(learnerId, deckSlug)

    return yield* Option.match(found, {
      onNone: () => Effect.fail(new DeckNotFound()),
      onSome: Effect.succeed
    })
  })

/** The session of the Learner, locked until the surrounding transaction ends, or `SessionNotFound`. */
export const requireOwnedSession = (
  learnerId: bigint,
  sessionSlug: string
): Effect.Effect<SessionRecord, SessionNotFound, StudyRepo> =>
  Effect.gen(function* () {
    const repo = yield* StudyRepo
    const found = yield* repo.lockOwnedSession(learnerId, sessionSlug)

    return yield* Option.match(found, {
      onNone: () => Effect.fail(new SessionNotFound()),
      onSome: Effect.succeed
    })
  })

/** The question at a position, locked until the surrounding transaction ends, or `QuestionNotFound`. */
export const requireQuestion = (
  sessionId: bigint,
  position: number
): Effect.Effect<QuestionRecord, QuestionNotFound, StudyRepo> =>
  Effect.gen(function* () {
    const repo = yield* StudyRepo
    const found = yield* repo.lockQuestion(sessionId, position)

    return yield* Option.match(found, {
      onNone: () => Effect.fail(new QuestionNotFound()),
      onSome: Effect.succeed
    })
  })

/** The due instant of every card, in epoch milliseconds, by card key. */
export const dueIndexOf = (cards: ReadonlyArray<DeckCard>): Map<string, number> =>
  new Map(cards.map((card) => [cardKey(card.wordId, card.drill), DateTime.toEpochMillis(card.due)]))

/** Words by id. A missing one breaks a stored reference, so it is a defect, not a domain error. */
export const loadWords = (
  ids: ReadonlyArray<bigint>
): Effect.Effect<ReadonlyMap<bigint, StudyWord>, never, StudyRepo> =>
  Effect.gen(function* () {
    const repo = yield* StudyRepo
    const words = yield* repo.wordsByIds([...new Set(ids)])

    return new Map(words.map((word) => [word.id, word] as const))
  })

export const wordAt = (words: ReadonlyMap<bigint, StudyWord>, id: bigint): Effect.Effect<StudyWord> =>
  Effect.fromNullishOr(words.get(id)).pipe(Effect.orDie)
