import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { ALPHABET, type Drill } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { normalizeKey } from "../src/library/domain/text.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// A session always holds at least one word, the new count never promises words the decks don't have,
// and the queue carries an estimate measured from the Learner's own pace.
// The clock is 2026-11-14T00:00Z, Learners are in UTC with dayStartHour 4, so today runs 2026-11-13T04:00Z..2026-11-14T04:00Z.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const TODAY_START = "2026-11-13T04:00:00Z"

let serial = 0

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

/** `count` words, each with a reading so all 4 drills apply. */
const seedDeck = (ownerId: bigint, count: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const deckSlug = nextSlug(10)

    const [deck] = yield* sql<{ readonly id: string }>`
      INSERT INTO decks (slug, owner_id, title, description, term_lang, meaning_lang, visibility, fork_count,
        created_at, updated_at)
      VALUES (${deckSlug}, ${ownerId}, 'Deck', '', 'ja', 'en', 'private', 0,
        '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')
      RETURNING id::text AS id`

    const wordIds: Array<bigint> = []

    for (let i = 0; i < count; i++) {
      const [row] = yield* sql<{ readonly id: string }>`
        INSERT INTO words (slug, deck_id, term, reading, meaning, term_key, reading_key, meaning_key, created_at)
        VALUES (${nextSlug(12)}, ${deck!.id}, ${`語${i}`}, ${`ご${i}`}, ${`meaning ${i}`},
          ${normalizeKey(`語${i}`)}, ${normalizeKey(`ご${i}`)}, ${normalizeKey(`meaning ${i}`)},
          '2026-11-01T00:00:00Z')
        RETURNING id::text AS id`

      wordIds.push(BigInt(row!.id))
    }

    return { deckSlug, deckId: BigInt(deck!.id), wordIds }
  })

const seedCard = (learnerId: bigint, wordId: bigint, drill: Drill, due: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      INSERT INTO cards (word_id, drill, learner_id, stability, difficulty, due, last_review, reps, lapses, is_hard)
      VALUES (${wordId}, ${drill}, ${learnerId}, 10, 5, ${new Date(due)}, '2026-11-01T00:00:00Z', 3, 0, false)`
  })

/** Every drill of every word gets a card, so the deck has nothing new left. */
const studyEveryPair = (learnerId: bigint, wordIds: ReadonlyArray<bigint>, due: string) =>
  Effect.forEach(wordIds, (wordId) =>
    Effect.forEach(["term_meaning", "meaning_term", "term_reading", "reading_term"] as const, (drill) =>
      seedCard(learnerId, wordId, drill, due)
    )
  )

/** A finished session whose first attempts run from `from`, one every `everySeconds`. */
const seedFinishedSession = (
  learnerId: bigint,
  wordIds: ReadonlyArray<bigint>,
  from: string,
  everySeconds: number
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const [session] = yield* sql<{ readonly id: string }>`
      INSERT INTO study_sessions (slug, learner_id, scope_deck_id, drills, mode, size, status, created_at, ended_at)
      VALUES (${nextSlug(14)}, ${learnerId}, NULL, ARRAY['term_meaning'], 'easy', ${wordIds.length}, 'completed',
        ${new Date(from)}, ${new Date(from)})
      RETURNING id::text AS id`

    for (const [index, wordId] of wordIds.entries()) {
      const reviewedAt = new Date(new Date(from).getTime() + index * everySeconds * 1000)

      yield* sql`
        INSERT INTO reviews (word_id, drill, learner_id, session_id, reviewed_at, rating, correct, mode, latency_ms,
          state_before, retrievability, stability_after, difficulty_after, scheduled_days)
        VALUES (${wordId}, 'term_meaning', ${learnerId}, ${session!.id}, ${reviewedAt}, 3, true, 'easy', 2000,
          'review', 0.9, 5, 5, 5)`
    }
  })

const setNewPerDay = (learnerId: bigint, newPerDay: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`UPDATE learners SET new_per_day = ${newPerDay} WHERE id = ${learnerId}`
  })

const start = (token: string, deckSlug: string) =>
  call(
    (c) =>
      c.study.start({
        payload: { scope: { kind: "deck", deckSlug: deckSlug as never }, drills: ["term_meaning"], size: 7, mode: "easy" }
      }),
    token
  )

const notifications = (token: string) => call((c) => c.insight.notifications(), token)

const activeSessions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql<{ readonly n: string }>`SELECT count(*)::text AS n FROM study_sessions`
  return Number(rows[0]!.n)
})

describe("POST /sessions with nothing to study", () => {
  test("nothing due and no new word left: NothingToStudy, and no session row is written", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, 5)

        yield* studyEveryPair(id, deck.wordIds, "2026-11-20T04:00:00Z")

        const error = yield* start(token, deck.deckSlug).pipe(Effect.flip)

        expect(error._tag).toBe("NothingToStudy")
        expect(yield* activeSessions).toBe(0)
      })
    ))

  test("the daily new limit is spent and nothing is due: NothingToStudy", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, 5)

        yield* setNewPerDay(id, 1)
        yield* seedFinishedSession(id, [deck.wordIds[0]!], "2026-11-13T09:00:00Z", 10)
        yield* seedCard(id, deck.wordIds[0]!, "term_meaning", "2026-11-20T04:00:00Z")

        const sql = yield* SqlClient.SqlClient
        yield* sql`UPDATE reviews SET state_before = 'new' WHERE learner_id = ${id}`

        const error = yield* start(token, deck.deckSlug).pipe(Effect.flip)

        expect(error._tag).toBe("NothingToStudy")
      })
    ))

  test("one due word is enough for a session", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, 5)

        yield* studyEveryPair(id, deck.wordIds, "2026-11-20T04:00:00Z")

        const sql = yield* SqlClient.SqlClient
        yield* sql`UPDATE cards SET due = ${new Date(TODAY_START)}
                   WHERE word_id = ${deck.wordIds[0]!} AND drill = 'term_meaning'`

        const session = yield* start(token, deck.deckSlug)

        expect(session.size).toBe(1)
        expect(session.questions).toHaveLength(1)
      })
    ))
})

describe("GET /notifications", () => {
  test("the new count is the allowance capped by the words that have no card yet", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, 2)

        // 2 words x 4 drills = 8 studyable pairs; 7 are studied, so 1 is really new while the allowance is 20.
        yield* studyEveryPair(id, deck.wordIds, "2026-11-20T04:00:00Z")

        const sql = yield* SqlClient.SqlClient
        yield* sql`DELETE FROM cards WHERE word_id = ${deck.wordIds[1]!} AND drill = 'reading_term'`

        const panel = yield* notifications(token)

        expect(panel.newAvailable).toBe(1)
      })
    ))

  test("nothing studied yet: the allowance still caps the count", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")

        // 10 words x 4 drills = 40 studyable pairs, but only 3 new words a day.
        yield* seedDeck(id, 10)
        yield* setNewPerDay(id, 3)

        const panel = yield* notifications(token)

        expect(panel.newAvailable).toBe(3)
      })
    ))

  test("the estimate is the Learner's median seconds per card times the queue", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, 4)

        yield* setNewPerDay(id, 0)

        // Two finished sessions at 10 s and 20 s per card: the median pace is 15 s.
        yield* seedFinishedSession(id, deck.wordIds, "2026-11-10T09:00:00Z", 10)
        yield* seedFinishedSession(id, deck.wordIds, "2026-11-11T09:00:00Z", 20)

        // 4 cards due today, no new words: 4 x 15 s = 1 minute.
        yield* Effect.forEach(deck.wordIds, (wordId) => seedCard(id, wordId, "term_meaning", TODAY_START))

        const panel = yield* notifications(token)

        expect(panel.estimatedMinutes).toBe(1)
      })
    ))

  test("a session left open does not skew the pace: each one counts at most 120 s per card", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, 4)

        yield* setNewPerDay(id, 0)

        // One session answered over 3 hours (2700 s per card) counts as 120 s.
        yield* seedFinishedSession(id, deck.wordIds, "2026-11-10T09:00:00Z", 2700)
        yield* Effect.forEach(deck.wordIds, (wordId) => seedCard(id, wordId, "term_meaning", TODAY_START))

        const panel = yield* notifications(token)

        expect(panel.estimatedMinutes).toBe(8)
      })
    ))

  test("no finished session, or an empty queue, means no estimate", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, 2)

        yield* setNewPerDay(id, 0)
        yield* Effect.forEach(deck.wordIds, (wordId) => seedCard(id, wordId, "term_meaning", TODAY_START))

        // Due cards but no pace to measure.
        expect((yield* notifications(token)).estimatedMinutes).toBeNull()

        const sql = yield* SqlClient.SqlClient
        yield* sql`UPDATE cards SET due = ${new Date("2026-11-20T04:00:00Z")} WHERE learner_id = ${id}`
        yield* seedFinishedSession(id, deck.wordIds, "2026-11-10T09:00:00Z", 10)

        // A pace, but nothing in the queue.
        expect((yield* notifications(token)).estimatedMinutes).toBeNull()
      })
    ))
})
