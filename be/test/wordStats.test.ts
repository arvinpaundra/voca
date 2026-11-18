import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { retrievability } from "../src/study/domain/fsrs.ts"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, seedReview, seedSessionAttempts, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// GET /words/:wordSlug/stats: one entry per drill the word has a Card in, every metric of the word page.
// The clock is 2026-11-14T00:00Z. Cards, reviews and session attempts are seeded with SQL.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const wordStats = (token: string, wordSlug: string) =>
  call((c) => c.insight.wordStats({ params: { wordSlug: wordSlug as never } }), token)

const iso = (value: unknown) => new Date(String(value)).toISOString()

/** A word studied in two drills: five first attempts and two sessions in Term → Meaning, a mature hard card in Reading → Term. */
const seedStudiedWord = Effect.gen(function* () {
  const ada = yield* signedIn("ADA00001")
  const deck = yield* seedDeck(ada.id, wordList(4))
  const [w0, w1, w2] = deck.words

  yield* seedCard(ada.id, w0!.id, "term_meaning", {
    due: "2026-11-22T00:00:00Z",
    stability: 12,
    difficulty: 5.5,
    lastReview: "2026-11-10T00:00:00Z",
    reps: 6,
    lapses: 4
  })
  yield* seedCard(ada.id, w0!.id, "reading_term", {
    due: "2026-12-13T00:00:00Z",
    stability: 30,
    difficulty: 3,
    lastReview: "2026-11-13T00:00:00Z",
    reps: 3,
    lapses: 0,
    hard: true
  })

  const reviews = [
    { at: "2026-11-01T10:00:00Z", correct: true, latencyMs: 3000, stateBefore: "new", retrievability: null, scheduledDays: 1 },
    { at: "2026-11-02T10:00:00Z", correct: false, latencyMs: 4000, retrievability: 0.9, scheduledDays: 1, chosenWordId: w1!.id },
    { at: "2026-11-04T10:00:00Z", correct: true, latencyMs: 2000, mode: "hard", retrievability: 0.85, scheduledDays: 3 },
    { at: "2026-11-07T10:00:00Z", correct: true, latencyMs: 1000, retrievability: 0.88, scheduledDays: 3 },
    { at: "2026-11-10T10:00:00Z", correct: true, latencyMs: 2500, rating: 3, retrievability: 0.9, scheduledDays: 12 }
  ] as const

  for (const review of reviews) {
    yield* seedReview(ada.id, w0!.id, "term_meaning", review)
  }

  // Two sessions: cleared on the third attempt after picking w1 twice, then on the second after picking w2.
  yield* seedSessionAttempts(
    ada.id,
    w0!.id,
    "term_meaning",
    [
      { correct: false, chosenWordId: w1!.id },
      { correct: false, chosenWordId: w1!.id },
      { correct: true, chosenWordId: w0!.id }
    ],
    "2026-11-02T10:05:00Z"
  )
  yield* seedSessionAttempts(
    ada.id,
    w0!.id,
    "term_meaning",
    [
      { correct: false, chosenWordId: w2!.id },
      { correct: true, chosenWordId: w0!.id }
    ],
    "2026-11-07T10:05:00Z"
  )

  return { ada, deck, w0: w0!, w1: w1!, w2: w2! }
})

describe("GET /words/:wordSlug/stats", () => {
  test("the word and one entry per studied drill", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, w0 } = yield* seedStudiedWord

        const stats = yield* wordStats(ada.token, w0.slug)

        expect(String(stats.word.slug)).toBe(w0.slug)
        expect(stats.word.term).toBe(w0.term)
        expect(stats.drills.map((d) => d.drill).sort()).toEqual(["reading_term", "term_meaning"])
        expect(stats.drills.every((d) => d.label.length > 0)).toBe(true)
      })
    )
  })

  test("memory: maturity, recall now, stability, difficulty, effort, leech and hard", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, w0 } = yield* seedStudiedWord

        const stats = yield* wordStats(ada.token, w0.slug)
        const meaning = stats.drills.find((d) => d.drill === "term_meaning")!
        const reading = stats.drills.find((d) => d.drill === "reading_term")!

        expect(meaning.maturity).toBe("learning")
        expect(meaning.recallNow).toBeCloseTo(retrievability(4, 12), 6)
        expect(meaning.stabilityDays).toBe(12)
        expect(meaning.difficulty).toBe(5.5)
        expect(meaning.reps).toBe(6)
        expect(meaning.lapses).toBe(4)
        expect(meaning.leech).toBe(true)
        expect(meaning.isHard).toBe(false)

        expect(reading.maturity).toBe("mature")
        expect(reading.leech).toBe(false)
        expect(reading.isHard).toBe(true)
      })
    )
  })

  test("from first attempts: accuracy, streak, median answer time, due, interval, first seen and last reviewed", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, w0 } = yield* seedStudiedWord

        const stats = yield* wordStats(ada.token, w0.slug)
        const meaning = stats.drills.find((d) => d.drill === "term_meaning")!

        expect(meaning.accuracy.overall).toBeCloseTo(0.8, 6)
        expect(meaning.accuracy.last10).toBeCloseTo(0.8, 6)
        expect(meaning.accuracy.easy).toBeCloseTo(0.75, 6)
        expect(meaning.accuracy.hard).toBeCloseTo(1, 6)
        expect(meaning.streak).toBe(3)
        expect(meaning.medianLatencyMs).toBe(2500)
        expect(iso(meaning.nextDue)).toBe("2026-11-22T00:00:00.000Z")
        expect(meaning.intervalDays).toBe(12)
        expect(iso(meaning.firstSeen)).toBe("2026-11-01T10:00:00.000Z")
        expect(iso(meaning.lastReviewed)).toBe("2026-11-10T10:00:00.000Z")
      })
    )
  })

  test("history is newest first, one entry per first attempt", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, w0 } = yield* seedStudiedWord

        const stats = yield* wordStats(ada.token, w0.slug)
        const history = stats.drills.find((d) => d.drill === "term_meaning")!.history

        expect(history).toHaveLength(5)
        expect(iso(history[0]!.at)).toBe("2026-11-10T10:00:00.000Z")
        expect(history[0]).toMatchObject({ correct: true, rating: 3, latencyMs: 2500, intervalDays: 12 })
        expect(history[0]!.predictedRecall).toBeCloseTo(0.9, 6)
        expect(history[3]).toMatchObject({ correct: false, latencyMs: 4000 })
        expect(history[4]!.predictedRecall).toBeNull()
      })
    )
  })

  test("from session attempts: confused with (most picked first) and attempts to clear", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, w0, w1, w2 } = yield* seedStudiedWord

        const stats = yield* wordStats(ada.token, w0.slug)
        const meaning = stats.drills.find((d) => d.drill === "term_meaning")!

        expect(meaning.confusedWith.map((c) => ({ slug: String(c.wordSlug), term: c.term, count: c.count }))).toEqual([
          { slug: w1.slug, term: w1.term, count: 2 },
          { slug: w2.slug, term: w2.term, count: 1 }
        ])
        expect(meaning.attemptsToCorrect).toBeCloseTo(2.5, 6)
      })
    )
  })

  test("a word with no cards has no drills; another learner's word is not found", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, deck } = yield* seedStudiedWord
        const bob = yield* signedIn("BB000001")

        const fresh = yield* wordStats(ada.token, deck.words[3]!.slug)
        expect(fresh.drills).toEqual([])

        const theirs = yield* wordStats(bob.token, deck.words[0]!.slug).pipe(Effect.flip)
        expect(theirs._tag).toBe("NotFound")
      })
    )
  })
})
