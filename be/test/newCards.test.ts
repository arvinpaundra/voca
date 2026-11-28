import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import type { Drill, Question } from "@voca/contract"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, seedReview, signedIn, wordList, type SeededWord } from "./seed.ts"
import { resetDb } from "./setup.ts"

// The daily new-card target is tracked, never enforced: sessions, drill counts and the notification panel ignore it.
// The clock is 2026-11-14T00:00Z and Learners are in UTC with dayStartHour 4,
// so today's study day runs from 2026-11-13T04:00Z to 2026-11-14T04:00Z.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const TODAY = "2026-11-13T09:00:00Z"
const YESTERDAY = "2026-11-13T03:00:00Z"
const TODAY_START = "2026-11-13T04:00:00Z"
const LATER = "2026-11-20T04:00:00Z"

const DRILLS: ReadonlyArray<Drill> = ["term_meaning", "meaning_term", "term_reading", "reading_term"]

const setTarget = (learnerId: bigint, target: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`UPDATE learners SET new_per_day = ${target} WHERE id = ${learnerId}`
  })

const snooze = (deckId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`UPDATE decks SET snoozed_at = '2026-11-13T05:00:00Z', snoozed_until = NULL WHERE id = ${deckId}`
  })

/** `count` first reviews on the pairs of `words`, drill by drill: each one is a card studied for the first time. */
const firstReviews = (learnerId: bigint, words: ReadonlyArray<SeededWord>, count: number, reviewedAt = TODAY) =>
  Effect.forEach(
    words.flatMap((word) => DRILLS.map((drill) => ({ word, drill }))).slice(0, count),
    ({ word, drill }) => seedReview(learnerId, word.id, drill, { at: reviewedAt, correct: true, stateBefore: "new" })
  )

/** Every pair of `words` gets a card due later, so they have nothing new or due left. */
const studied = (learnerId: bigint, words: ReadonlyArray<SeededWord>) =>
  Effect.forEach(words, (word) =>
    Effect.forEach(DRILLS, (drill) => seedCard(learnerId, word.id, drill, { due: LATER }))
  )

const setup = (token: string, deckSlug: string) =>
  call((c) => c.study.deckSetup({ params: { deckSlug: deckSlug as never } }), token)

const deckDrills = (token: string, deckSlug: string) =>
  call((c) => c.study.deckDrills({ params: { deckSlug: deckSlug as never } }), token)

const start = (token: string, deckSlug: string, size: 7 | 10 | 15 | 20) =>
  call(
    (c) =>
      c.study.start({
        payload: { scope: { kind: "deck", deckSlug: deckSlug as never }, drills: ["term_meaning"], size, mode: "easy" }
      }),
    token
  )

const answerRight = (token: string, sessionSlug: string, question: Question) =>
  call(
    (c) =>
      c.study.answer({
        params: { sessionSlug: sessionSlug as never },
        payload: { position: question.position, chosenWordSlug: question.wordSlug, latencyMs: 2000 }
      }),
    token
  )

const notifications = (token: string) => call((c) => c.insight.notifications(), token)

const slugsOf = (questions: ReadonlyArray<Question>) => questions.map((question) => String(question.wordSlug))

describe("GET /decks/:deckSlug/setup", () => {
  test("counts today's first reviews in every drill against the target, and lists the deck's drills", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, wordList(5, "甲"))
        const other = yield* seedDeck(id, wordList(4, "乙"))

        yield* setTarget(id, 30)
        yield* firstReviews(id, other.words, 12)
        yield* firstReviews(id, deck.words, 1, YESTERDAY)
        yield* seedReview(id, other.words[0]!.id, "term_meaning", { at: TODAY, correct: true, stateBefore: "review" })

        const result = yield* setup(token, deck.deckSlug)

        expect(result.newCards).toEqual({ studied: 12, target: 30 })
        expect(result.drills).toEqual(yield* deckDrills(token, deck.deckSlug))
        expect(result.drills.map((drill) => drill.drill)).toEqual([...DRILLS])
      })
    ))

  test("first reviews in a snoozed deck count toward the target", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, wordList(5, "甲"))
        const sleepy = yield* seedDeck(id, wordList(2, "眠"))

        yield* snooze(sleepy.deckId)
        yield* firstReviews(id, sleepy.words, 3)

        const result = yield* setup(token, deck.deckSlug)

        expect(result.newCards).toEqual({ studied: 3, target: 20 })
      })
    ))

  test("someone else's deck answers NotFound", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("BCDEFGHJ")
        const deck = yield* seedDeck(ada.id, wordList(5))

        const error = yield* setup(bob.token, deck.deckSlug).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))
})

describe("the target never limits a session", () => {
  test("at the target with nothing due, a size-20 session holds 20 new cards, and they count past it", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, wordList(25, "甲"))
        const other = yield* seedDeck(id, wordList(8, "乙"))

        yield* setTarget(id, 30)
        yield* studied(id, other.words)
        yield* firstReviews(id, other.words, 30)

        const session = yield* start(token, deck.deckSlug, 20)

        expect(session.size).toBe(20)
        expect(session.questions).toHaveLength(20)

        for (const question of session.questions) {
          yield* answerRight(token, session.slug, question)
        }

        const result = yield* setup(token, deck.deckSlug)

        expect(result.newCards).toEqual({ studied: 50, target: 30 })
      })
    ))

  test("past the target, 5 due cards leave room for 15 new ones in a size-20 session", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, wordList(25, "甲"))
        const other = yield* seedDeck(id, wordList(8, "乙"))
        const due = deck.words.slice(0, 5)

        yield* setTarget(id, 30)
        yield* studied(id, other.words)
        yield* firstReviews(id, other.words, 30)
        yield* Effect.forEach(due, (word) => seedCard(id, word.id, "term_meaning", { due: TODAY_START }))

        const session = yield* start(token, deck.deckSlug, 20)
        const slugs = slugsOf(session.questions)

        expect(session.size).toBe(20)
        expect(session.questions).toHaveLength(20)
        expect(slugs).toEqual(expect.arrayContaining(due.map((word) => word.slug)))
      })
    ))

  test("a target of 0 still lets new cards in", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, wordList(10))

        yield* setTarget(id, 0)

        const session = yield* start(token, deck.deckSlug, 7)

        expect(session.size).toBe(7)
      })
    ))
})

describe("drill and panel counts ignore the target", () => {
  test("past the target, each drill's new count is the deck's words with no card in it", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, wordList(6, "甲"))
        const other = yield* seedDeck(id, wordList(1, "乙"))

        yield* setTarget(id, 3)
        yield* firstReviews(id, other.words, 4)
        yield* seedCard(id, deck.words[0]!.id, "term_meaning", { due: LATER })

        const drills = yield* deckDrills(token, deck.deckSlug)
        const fromSetup = (yield* setup(token, deck.deckSlug)).drills

        expect(drills.map((drill) => [drill.drill, drill.new])).toEqual([
          ["term_meaning", 5],
          ["meaning_term", 6],
          ["term_reading", 6],
          ["reading_term", 6]
        ])
        expect(fromSetup).toEqual(drills)
      })
    ))

  test("with 30 new cards today and 40 left in the decks, the panel offers 40", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const done = yield* seedDeck(id, wordList(8, "乙"))

        yield* seedDeck(id, wordList(10, "甲"))
        yield* setTarget(id, 30)
        yield* studied(id, done.words)
        yield* firstReviews(id, done.words, 30)

        const panel = yield* notifications(token)

        expect(panel.newAvailable).toBe(40)
      })
    ))
})
