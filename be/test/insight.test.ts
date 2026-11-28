import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { ALPHABET, type Drill } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { normalizeKey } from "../src/library/domain/text.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// Insight read models over HTTP. Decks, words, cards and reviews are seeded with SQL.
// The clock is 2026-11-14T00:00Z and Learners are in UTC with dayStartHour 4,
// so today's study day is 2026-11-13, running from 2026-11-13T04:00Z to 2026-11-14T04:00Z.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

let serial = 0

/** A fresh slug of the given length, valid in the Crockford alphabet. */
const nextSlug = (length: number) =>
  (++serial)
    .toString(32)
    .padStart(length, "0")
    .split("")
    .map((digit) => ALPHABET[parseInt(digit, 32)])
    .join("")

const signedIn = (slug: string) =>
  Effect.gen(function* () {
    const id = yield* seedLearner(slug)
    const signer = yield* TokenSigner
    const token = (yield* signer.sign(slug as never)).token
    return { id, token }
  })

type NewWord = { readonly term: string; readonly meaning: string; readonly reading?: string }

/** `count` words with distinct terms; each has a reading (so all 4 drills apply) unless `withReading` is false. */
const words = (count: number, withReading = true, prefix = "語"): Array<NewWord> =>
  Array.from({ length: count }, (_, i) => ({
    term: `${prefix}${i}`,
    meaning: `meaning ${prefix}${i}`,
    ...(withReading ? { reading: `ご${prefix}${i}` } : {})
  }))

const seedDeck = (ownerId: bigint, list: ReadonlyArray<NewWord>, title = "Deck") =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const deckSlug = nextSlug(10)

    const [deck] = yield* sql<{ readonly id: string }>`
      INSERT INTO decks (slug, owner_id, title, description, term_lang, meaning_lang, visibility, fork_count,
        created_at, updated_at)
      VALUES (${deckSlug}, ${ownerId}, ${title}, '', 'ja', 'en', 'private', 0,
        '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')
      RETURNING id::text AS id`

    const ids: Array<bigint> = []

    for (const word of list) {
      const [row] = yield* sql<{ readonly id: string }>`
        INSERT INTO words (slug, deck_id, term, reading, meaning, term_key, reading_key, meaning_key, created_at)
        VALUES (${nextSlug(12)}, ${deck!.id}, ${word.term}, ${word.reading ?? null}, ${word.meaning},
          ${normalizeKey(word.term)}, ${normalizeKey(word.reading ?? "")}, ${normalizeKey(word.meaning)},
          '2026-11-01T00:00:00Z')
        RETURNING id::text AS id`

      ids.push(BigInt(row!.id))
    }

    return { deckSlug, deckId: BigInt(deck!.id), wordIds: ids }
  })

/** Soft-deletes a deck the way the delete use case does: the deck, its words and their cards. */
const deleteDeck = (deckId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const now = new Date("2026-11-13T12:00:00Z")

    yield* sql`UPDATE decks SET deleted_at = ${now} WHERE id = ${deckId}`
    yield* sql`UPDATE words SET deleted_at = ${now} WHERE deck_id = ${deckId}`
    yield* sql`UPDATE cards SET deleted_at = ${now} WHERE word_id IN (SELECT id FROM words WHERE deck_id = ${deckId})`
  })

type CardSeed = { readonly due: string; readonly stability?: number; readonly isHard?: boolean }

const seedCard = (learnerId: bigint, wordId: bigint, drill: Drill, card: CardSeed) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      INSERT INTO cards (word_id, drill, learner_id, stability, difficulty, due, last_review, reps, lapses, is_hard)
      VALUES (${wordId}, ${drill}, ${learnerId}, ${card.stability ?? 10}, 5, ${new Date(card.due)},
        '2026-11-01T00:00:00Z', 3, 0, ${card.isHard ?? false})`
  })

type ReviewSeed = {
  readonly at: string
  readonly drill?: Drill
  readonly stateBefore?: "new" | "review"
  readonly correct?: boolean
  readonly retrievability?: number
}

/** One first attempt. A `review`-state attempt carries the predicted recall it was scheduled with. */
const seedReview = (learnerId: bigint, wordId: bigint, review: ReviewSeed) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const stateBefore = review.stateBefore ?? "review"
    const retrievability = stateBefore === "new" ? null : review.retrievability ?? 0.9

    yield* sql`
      INSERT INTO reviews (word_id, drill, learner_id, reviewed_at, rating, correct, mode, latency_ms, state_before,
        retrievability, stability_after, difficulty_after, scheduled_days)
      VALUES (${wordId}, ${review.drill ?? "term_meaning"}, ${learnerId}, ${new Date(review.at)},
        ${review.correct === false ? 1 : 3}, ${review.correct ?? true}, 'easy', 2000, ${stateBefore},
        ${retrievability}, 5, 5, 5)`
  })

const deckStats = (token: string, deckSlug: string) =>
  call((c) => c.insight.deckStats({ params: { deckSlug: deckSlug as never } }), token)

const learnerStats = (token: string) => call((c) => c.insight.learnerStats(), token)

const notifications = (token: string) => call((c) => c.insight.notifications(), token)

const activity = (token: string, month?: string) =>
  call((c) => c.insight.activity({ query: month === undefined ? {} : { month } }), token)

/** The 7 study days after today, each with its count of cards falling due that day. */
const forecastWith = (counts: Record<string, number>) =>
  ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"].map((date) => ({
    date,
    count: counts[date] ?? 0
  }))

describe("GET /decks/:deckSlug/stats", () => {
  test("counts cards by maturity, with unstudied (word, drill) pairs as new", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")

        // 3 words with a reading (4 drills each) and 1 without (2 drills): 14 studyable pairs.
        const deck = yield* seedDeck(id, [...words(3), ...words(1, false, "単")])
        const [w0, w1] = deck.wordIds

        yield* seedCard(id, w0!, "term_meaning", { due: "2026-11-20T04:00:00Z", stability: 5 })
        yield* seedCard(id, w0!, "meaning_term", { due: "2026-11-20T04:00:00Z", stability: 30 })
        yield* seedCard(id, w1!, "term_reading", { due: "2026-11-20T04:00:00Z", stability: 21 })

        const stats = yield* deckStats(token, deck.deckSlug)

        expect(stats.maturity).toEqual({ new: 11, learning: 1, mature: 2 })
      })
    ))

  test("due today includes overdue; the forecast buckets the next 7 study days", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(4))
        const [w0, w1, w2, w3] = deck.wordIds

        yield* seedCard(id, w0!, "term_meaning", { due: "2026-11-10T04:00:00Z" })
        yield* seedCard(id, w1!, "term_meaning", { due: "2026-11-13T04:00:00Z" })
        yield* seedCard(id, w2!, "term_meaning", { due: "2026-11-14T04:00:00Z" })
        yield* seedCard(id, w2!, "meaning_term", { due: "2026-11-20T04:00:00Z" })
        yield* seedCard(id, w3!, "term_meaning", { due: "2026-11-21T04:00:00Z" })

        const stats = yield* deckStats(token, deck.deckSlug)

        expect(stats.dueToday).toBe(2)
        expect(stats.overdue).toBe(1)
        expect(stats.forecast).toEqual(forecastWith({ "2026-11-14": 1, "2026-11-20": 1 }))
      })
    ))

  test("retention and calibration use the last 30 days of review-state first attempts", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(2))
        const [w0, w1] = deck.wordIds

        yield* seedReview(id, w0!, { at: "2026-11-01T10:00:00Z", correct: true, retrievability: 0.9 })
        yield* seedReview(id, w0!, { at: "2026-11-10T10:00:00Z", correct: true, retrievability: 0.8 })
        yield* seedReview(id, w1!, { at: "2026-11-13T10:00:00Z", correct: false, retrievability: 0.7 })

        // Not counted: a first-ever attempt, and an attempt older than 30 study days.
        yield* seedReview(id, w1!, { at: "2026-11-02T10:00:00Z", stateBefore: "new", correct: false })
        yield* seedReview(id, w1!, { at: "2026-10-01T10:00:00Z", correct: false, retrievability: 0.1 })

        const stats = yield* deckStats(token, deck.deckSlug)

        expect(stats.trueRetention).toBeCloseTo(2 / 3, 5)
        expect(stats.calibration!.predicted).toBeCloseTo(0.8, 5)
        expect(stats.calibration!.actual).toBeCloseTo(2 / 3, 5)
      })
    ))

  test("reviews per day lists the last 30 study days, oldest first, with empty days as 0", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(2))
        const [w0, w1] = deck.wordIds

        yield* seedReview(id, w0!, { at: "2026-10-15T10:00:00Z", stateBefore: "new" })
        yield* seedReview(id, w0!, { at: "2026-11-13T10:00:00Z" })
        yield* seedReview(id, w1!, { at: "2026-11-13T10:00:00Z", stateBefore: "new" })

        // 03:00 is before dayStartHour, so this counts for the study day of 12 Nov.
        yield* seedReview(id, w1!, { at: "2026-11-13T03:00:00Z" })

        const stats = yield* deckStats(token, deck.deckSlug)

        expect(stats.reviewsPerDay).toHaveLength(30)
        expect(stats.reviewsPerDay[0]).toEqual({ date: "2026-10-15", count: 1 })
        expect(stats.reviewsPerDay[28]).toEqual({ date: "2026-11-12", count: 1 })
        expect(stats.reviewsPerDay[29]).toEqual({ date: "2026-11-13", count: 2 })
        expect(stats.reviewsPerDay.reduce((sum, day) => sum + day.count, 0)).toBe(4)
      })
    ))

  test("a deck with no study history has no retention or calibration", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(1, false))

        const stats = yield* deckStats(token, deck.deckSlug)

        expect(stats.maturity).toEqual({ new: 2, learning: 0, mature: 0 })
        expect(stats.dueToday).toBe(0)
        expect(stats.trueRetention).toBeNull()
        expect(stats.calibration).toBeNull()
        expect(stats.forecast).toEqual(forecastWith({}))
      })
    ))

  test("another Learner's deck is not found", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const owner = yield* signedIn("ABCDEFGH")
        const other = yield* signedIn("HGFEDCBA")
        const deck = yield* seedDeck(owner.id, words(1))

        const error = yield* Effect.flip(deckStats(other.token, deck.deckSlug))

        expect(error._tag).toBe("NotFound")
      })
    ))
})

describe("GET /me/stats", () => {
  test("adds up every live deck and leaves out deleted ones", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const first = yield* seedDeck(id, words(1, false, "甲"))
        const second = yield* seedDeck(id, words(1, false, "乙"))
        const deleted = yield* seedDeck(id, words(1, false, "丙"))

        yield* seedCard(id, first.wordIds[0]!, "term_meaning", { due: "2026-11-13T04:00:00Z", stability: 3 })
        yield* seedCard(id, second.wordIds[0]!, "term_meaning", { due: "2026-11-16T04:00:00Z", stability: 40 })
        yield* seedCard(id, deleted.wordIds[0]!, "term_meaning", { due: "2026-11-13T04:00:00Z", stability: 3 })
        yield* deleteDeck(deleted.deckId)

        const stats = yield* learnerStats(token)

        expect(stats.maturity).toEqual({ new: 2, learning: 1, mature: 1 })
        expect(stats.dueToday).toBe(1)
        expect(stats.forecast).toEqual(forecastWith({ "2026-11-16": 1 }))
      })
    ))

  test("retention spans all decks, and history from a deleted deck still counts", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const first = yield* seedDeck(id, words(1, false, "甲"))
        const deleted = yield* seedDeck(id, words(1, false, "丙"))

        yield* seedReview(id, first.wordIds[0]!, { at: "2026-11-12T10:00:00Z", correct: true })
        yield* seedReview(id, deleted.wordIds[0]!, { at: "2026-11-12T10:00:00Z", correct: false })
        yield* deleteDeck(deleted.deckId)

        const stats = yield* learnerStats(token)

        expect(stats.trueRetention).toBeCloseTo(0.5, 5)
        expect(stats.reviewsPerDay[28]).toEqual({ date: "2026-11-12", count: 2 })
      })
    ))

  test("no reviews: a streak of 0", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token } = yield* signedIn("ABCDEFGH")

        const stats = yield* learnerStats(token)

        expect(stats.streak).toEqual({ days: 0, studiedToday: false })
        expect(stats.maturity).toEqual({ new: 0, learning: 0, mature: 0 })
      })
    ))

  test("the streak counts back from yesterday until today has a review", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(1))
        const [w0] = deck.wordIds

        // Study days 8, 10, 11 and 12 Nov: the gap on 9 Nov ends the run at 3 days.
        yield* seedReview(id, w0!, { at: "2026-11-08T10:00:00Z" })
        yield* seedReview(id, w0!, { at: "2026-11-10T10:00:00Z" })
        yield* seedReview(id, w0!, { at: "2026-11-11T10:00:00Z" })
        yield* seedReview(id, w0!, { at: "2026-11-11T20:00:00Z", drill: "meaning_term" })
        yield* seedReview(id, w0!, { at: "2026-11-13T03:00:00Z" })

        const before = yield* learnerStats(token)

        expect(before.streak).toEqual({ days: 3, studiedToday: false })

        yield* seedReview(id, w0!, { at: "2026-11-13T09:00:00Z", drill: "term_reading" })

        const after = yield* learnerStats(token)

        expect(after.streak).toEqual({ days: 4, studiedToday: true })
      })
    ))

  test("the streak is broken once a whole study day passes without a review", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(1))

        yield* seedReview(id, deck.wordIds[0]!, { at: "2026-11-11T10:00:00Z" })

        const stats = yield* learnerStats(token)

        expect(stats.streak).toEqual({ days: 0, studiedToday: false })
      })
    ))

  test("another Learner's reviews don't count", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const me = yield* signedIn("ABCDEFGH")
        const other = yield* signedIn("HGFEDCBA")
        const deck = yield* seedDeck(other.id, words(1))

        yield* seedReview(other.id, deck.wordIds[0]!, { at: "2026-11-13T10:00:00Z" })

        const stats = yield* learnerStats(me.token)

        expect(stats.streak).toEqual({ days: 0, studiedToday: false })
        expect(stats.trueRetention).toBeNull()
      })
    ))
})

describe("GET /notifications", () => {
  test("lists decks with due cards, most overdue first, with hard and new counts", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const calm = yield* seedDeck(id, words(1, true, "甲"), "Calm")
        const behind = yield* seedDeck(id, words(2, true, "乙"), "Behind")
        const idle = yield* seedDeck(id, words(1, true, "丙"), "Idle")

        yield* seedCard(id, calm.wordIds[0]!, "term_meaning", { due: "2026-11-13T04:00:00Z" })
        yield* seedCard(id, behind.wordIds[0]!, "term_meaning", { due: "2026-11-11T04:00:00Z", isHard: true })
        yield* seedCard(id, behind.wordIds[0]!, "term_reading", { due: "2026-11-13T04:00:00Z" })
        yield* seedCard(id, behind.wordIds[1]!, "term_meaning", { due: "2026-11-13T04:00:00Z" })
        yield* seedCard(id, idle.wordIds[0]!, "term_meaning", { due: "2026-11-14T04:00:00Z", isHard: true })

        // Two words were studied for the first time today, so the allowance is 18, but only 11 (word, drill)
        // pairs have no card yet.
        yield* seedReview(id, calm.wordIds[0]!, { at: "2026-11-13T09:00:00Z", stateBefore: "new" })
        yield* seedReview(id, behind.wordIds[1]!, { at: "2026-11-13T09:00:00Z", stateBefore: "new" })

        const panel = yield* notifications(token)

        expect(panel.hardDue).toBe(1)
        expect(panel.newAvailable).toBe(11)
        expect(panel.decks.map((deck) => [deck.deckSlug, deck.title, deck.due, deck.overdue])).toEqual([
          [behind.deckSlug, "Behind", 3, 1],
          [calm.deckSlug, "Calm", 1, 0]
        ])

        const byDrill = [...panel.decks[0]!.byDrill].sort((a, b) => a.drill.localeCompare(b.drill))

        expect(byDrill).toEqual([
          { drill: "term_meaning", label: "Word → Meaning", due: 2 },
          { drill: "term_reading", label: "Word → Kana", due: 1 }
        ])
      })
    ))

  test("new words available never goes below 0, and deleted decks are left out", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(3))
        const sql = yield* SqlClient.SqlClient

        yield* sql`UPDATE learners SET new_per_day = 2 WHERE id = ${id}`

        for (const wordId of deck.wordIds) {
          yield* seedReview(id, wordId, { at: "2026-11-13T09:00:00Z", stateBefore: "new" })
          yield* seedCard(id, wordId, "term_meaning", { due: "2026-11-13T04:00:00Z" })
        }

        yield* deleteDeck(deck.deckId)

        const panel = yield* notifications(token)

        expect(panel).toEqual({ decks: [], hardDue: 0, newAvailable: 0, estimatedMinutes: null })
      })
    ))
})

describe("GET /me/activity", () => {
  test("defaults to the current study month and sends only days with reviews", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(2))
        const [w0, w1] = deck.wordIds

        yield* seedReview(id, w0!, { at: "2026-11-01T03:00:00Z" })
        yield* seedReview(id, w0!, { at: "2026-11-04T10:00:00Z" })
        yield* seedReview(id, w1!, { at: "2026-11-04T11:00:00Z", stateBefore: "new" })
        yield* seedReview(id, w0!, { at: "2026-11-13T03:00:00Z" })

        const result = yield* activity(token)

        // 1 Nov 03:00 belongs to the study day of 31 Oct, so it is not in November.
        expect(result).toEqual({
          month: "2026-11",
          days: [
            { date: "2026-11-04", reviews: 2 },
            { date: "2026-11-12", reviews: 1 }
          ]
        })
      })
    ))

  test("an earlier month, a future month, and another Learner's reviews", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const me = yield* signedIn("ABCDEFGH")
        const other = yield* signedIn("HGFEDCBA")
        const mine = yield* seedDeck(me.id, words(1))
        const theirs = yield* seedDeck(other.id, words(1))

        yield* seedReview(me.id, mine.wordIds[0]!, { at: "2026-11-01T03:00:00Z" })
        yield* seedReview(other.id, theirs.wordIds[0]!, { at: "2026-10-20T10:00:00Z" })

        const october = yield* activity(me.token, "2026-10")
        const december = yield* activity(me.token, "2026-12")

        expect(october).toEqual({ month: "2026-10", days: [{ date: "2026-10-31", reviews: 1 }] })
        expect(december).toEqual({ month: "2026-12", days: [] })
      })
    ))

  test("history from a deleted deck stays on the heatmap", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(1))

        yield* seedReview(id, deck.wordIds[0]!, { at: "2026-11-05T10:00:00Z" })
        yield* deleteDeck(deck.deckId)

        const result = yield* activity(token)

        expect(result.days).toEqual([{ date: "2026-11-05", reviews: 1 }])
      })
    ))
})
