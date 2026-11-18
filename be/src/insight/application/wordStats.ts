import { DateTime, Effect, Option } from "effect"
import { CurrentLearner, drillLabel, type Drill, type WordDrillStats, type WordStats } from "@voca/contract"
import { retrievability } from "../../study/domain/fsrs.ts"
import {
  HISTORY_REVIEWS,
  RECENT_REVIEWS,
  RECENT_SESSIONS,
  accuracy,
  attemptsUntilCorrect,
  daysBetween,
  isLeech,
  maturityOf,
  meanAttempts,
  median,
  rankConfusions,
  streak
} from "../domain/wordStats.ts"
import { WordNotFound } from "./errors.ts"
import {
  InsightRepo,
  type PickedWord,
  type WordAttemptRow,
  type WordCardRow,
  type WordReviewRow
} from "./insightRepo.ts"

/** The average answers it took to clear the word per session, over the latest sessions of one drill. */
const attemptsToCorrect = (attempts: ReadonlyArray<WordAttemptRow>): number | null => {
  const bySession = new Map<bigint, Array<WordAttemptRow>>()

  // The rows come newest session first, so the map keeps that order.
  for (const attempt of attempts) {
    bySession.set(attempt.sessionId, [...(bySession.get(attempt.sessionId) ?? []), attempt])
  }

  return meanAttempts(
    [...bySession.values()].slice(0, RECENT_SESSIONS).map((answers) => attemptsUntilCorrect(answers))
  )
}

/** The metrics of one Card. `reviews` and `attempts` are the word's rows of this drill only; reviews newest first. */
const drillStats = (input: {
  readonly termLang: string
  readonly card: WordCardRow
  readonly reviews: ReadonlyArray<WordReviewRow>
  readonly attempts: ReadonlyArray<WordAttemptRow>
  readonly picked: ReadonlyMap<bigint, PickedWord>
  readonly now: DateTime.Utc
}): WordDrillStats => {
  const { card, reviews, attempts } = input
  const recent = reviews.slice(0, RECENT_REVIEWS)
  const latest = reviews[0]
  const oldest = reviews.at(-1)

  const confused = rankConfusions(
    attempts.flatMap((attempt) => (!attempt.correct && attempt.chosenWordId !== null ? [attempt.chosenWordId] : []))
  ).flatMap(({ wordId, count }) => {
    const word = input.picked.get(wordId)

    return word === undefined ? [] : [{ wordSlug: word.slug, term: word.term, count }]
  })

  return {
    drill: card.drill,
    label: drillLabel(input.termLang, card.drill),
    maturity: maturityOf(card.stability),
    recallNow: retrievability(
      daysBetween(DateTime.toDateUtc(card.lastReview), DateTime.toDateUtc(input.now)),
      card.stability
    ),
    stabilityDays: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    leech: isLeech(card.lapses),
    isHard: card.isHard,
    accuracy: {
      overall: accuracy(reviews),
      last10: accuracy(recent),
      easy: accuracy(reviews.filter((review) => review.mode === "easy")),
      hard: accuracy(reviews.filter((review) => review.mode === "hard"))
    },
    streak: streak(reviews),
    medianLatencyMs: median(recent.map((review) => review.latencyMs)),
    attemptsToCorrect: attemptsToCorrect(attempts),
    nextDue: card.due,
    intervalDays: latest?.scheduledDays ?? null,
    firstSeen: oldest?.reviewedAt ?? null,
    lastReviewed: latest?.reviewedAt ?? null,
    confusedWith: confused,
    history: reviews.slice(0, HISTORY_REVIEWS).map((review) => ({
      at: review.reviewedAt,
      correct: review.correct,
      rating: review.rating,
      latencyMs: review.latencyMs,
      predictedRecall: review.predictedRecall,
      intervalDays: review.scheduledDays
    }))
  }
}

const forDrill = <Row extends { readonly drill: Drill }>(rows: ReadonlyArray<Row>, drill: Drill): ReadonlyArray<Row> =>
  rows.filter((row) => row.drill === drill)

/** `GET /words/:wordSlug/stats`: the Learner's live word with the metrics of each drill it has a Card in, or `WordNotFound`. */
export const wordStats = (wordSlug: string): Effect.Effect<WordStats, WordNotFound, CurrentLearner | InsightRepo> =>
  Effect.gen(function* () {
    const { id: learnerId } = yield* CurrentLearner
    const repo = yield* InsightRepo
    const found = yield* repo.findOwnedWord(learnerId, wordSlug)
    const owned = yield* Option.match(found, {
      onNone: () => Effect.fail(new WordNotFound()),
      onSome: Effect.succeed
    })

    const now = yield* DateTime.now
    const cards = yield* repo.wordCards(learnerId, owned.id)
    const reviews = yield* repo.wordReviews(learnerId, owned.id)
    const attempts = yield* repo.wordAttempts(learnerId, owned.id)

    const pickedIds = [
      ...new Set(attempts.flatMap((attempt) => (!attempt.correct && attempt.chosenWordId !== null ? [attempt.chosenWordId] : [])))
    ]
    const picked = new Map((yield* repo.pickedWords(pickedIds)).map((word) => [word.id, word] as const))

    return {
      word: owned.word,
      drills: cards.map((card) =>
        drillStats({
          termLang: owned.termLang,
          card,
          reviews: forDrill(reviews, card.drill),
          attempts: forDrill(attempts, card.drill),
          picked,
          now
        })
      )
    }
  })
